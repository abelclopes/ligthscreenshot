using System.Text.Json;

namespace MinhaCaptura;

sealed record Shortcut(Keys Key, uint Modifiers)
{
    internal static readonly Keys[] SupportedKeys =
    [
        Keys.PrintScreen,
        .. Enumerable.Range((int)Keys.A, 26).Select(value => (Keys)value),
        .. Enumerable.Range((int)Keys.D0, 10).Select(value => (Keys)value),
        .. Enumerable.Range((int)Keys.F1, 24).Select(value => (Keys)value),
        Keys.Insert, Keys.Home, Keys.End, Keys.PageUp, Keys.PageDown, Keys.Pause, Keys.Scroll
    ];

    static string FilePath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MinhaCaptura", "settings.json");
    public bool IsValid => SupportedKeys.Contains(Key) && (Modifiers & ~15u) == 0;
    public static string KeyLabel(Keys key) => key switch
    {
        Keys.PrintScreen => "Print Screen",
        >= Keys.D0 and <= Keys.D9 => ((int)key - (int)Keys.D0).ToString(),
        _ => key.ToString()
    };
    public string Label => string.Join(" + ", new[]
    {
        (Modifiers & 2) != 0 ? "Ctrl" : null,
        (Modifiers & 1) != 0 ? "Alt" : null,
        (Modifiers & 4) != 0 ? "Shift" : null,
        (Modifiers & 8) != 0 ? "Win" : null,
        KeyLabel(Key)
    }.Where(part => part is not null));

    public static Shortcut Load()
    {
        try
        {
            var shortcut = JsonSerializer.Deserialize<Shortcut>(File.ReadAllText(FilePath));
            if (shortcut is { IsValid: true }) return shortcut;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        return new Shortcut(Keys.PrintScreen, 0);
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        var temporary = FilePath + ".tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(this));
            File.Move(temporary, FilePath, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}

sealed class SettingsDialog : Form
{
    public SettingsDialog(Shortcut current, Action<Shortcut> apply)
    {
        Text = "Configurações — Minha Captura";
        ClientSize = new Size(460, 250);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        var explanation = new Label { Text = "Atalho global para capturar a tela", AutoSize = true, Location = new Point(20, 20) };
        var modifiers = new FlowLayoutPanel { Location = new Point(20, 52), Size = new Size(420, 36) };
        var checks = new List<(CheckBox Box, uint Flag)>();
        foreach (var (name, flag) in new[] { ("Ctrl", 2u), ("Alt", 1u), ("Shift", 4u), ("Win", 8u) })
        {
            var check = new CheckBox { Text = name, Width = 90, Checked = (current.Modifiers & flag) != 0 };
            modifiers.Controls.Add(check);
            checks.Add((check, flag));
        }
        var keys = new ComboBox { Location = new Point(20, 98), Width = 220, DropDownStyle = ComboBoxStyle.DropDownList };
        keys.Items.AddRange(Shortcut.SupportedKeys.Select(key => (object)Shortcut.KeyLabel(key)).ToArray());
        keys.SelectedIndex = Array.IndexOf(Shortcut.SupportedKeys, current.Key);
        var preview = new Label { Location = new Point(20, 140), AutoSize = true };
        Shortcut Selected() => new(Shortcut.SupportedKeys[keys.SelectedIndex], checks.Aggregate(0u, (flags, entry) => flags | (entry.Box.Checked ? entry.Flag : 0)));
        void Preview() => preview.Text = "Atalho: " + Selected().Label;
        keys.SelectedIndexChanged += (_, _) => Preview();
        foreach (var entry in checks) entry.Box.CheckedChanged += (_, _) => Preview();
        Preview();
        var reset = new Button { Text = "Padrão: Print Screen", Location = new Point(20, 194), Size = new Size(160, 32) };
        reset.Click += (_, _) => { foreach (var entry in checks) entry.Box.Checked = false; keys.SelectedIndex = 0; };
        var save = new Button { Text = "Salvar", Location = new Point(260, 194), Size = new Size(80, 32) };
        save.Click += (_, _) =>
        {
            try { apply(Selected()); DialogResult = DialogResult.OK; }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "Não foi possível salvar", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        };
        var cancel = new Button { Text = "Cancelar", DialogResult = DialogResult.Cancel, Location = new Point(350, 194), Size = new Size(90, 32) };
        Controls.AddRange([explanation, modifiers, keys, preview, reset, save, cancel]);
        AcceptButton = save;
        CancelButton = cancel;
    }
}
