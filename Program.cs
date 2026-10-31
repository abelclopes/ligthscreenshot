using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace MinhaCaptura;

internal static class Program
{
    internal static Icon LoadIcon()
    {
        using var stream = typeof(Program).Assembly.GetManifestResourceStream("MinhaCaptura.AppIcon")
            ?? throw new InvalidOperationException("Ícone do aplicativo não encontrado.");
        using var icon = new Icon(stream);
        return (Icon)icon.Clone();
    }

    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var instance = new Mutex(true, @"Local\MinhaCaptura.Tray", out var firstInstance);
        if (!firstInstance) return;
        using var tray = new TrayApplication();
        Application.Run(tray);
    }
}

sealed class TrayApplication : ApplicationContext
{
    readonly NotifyIcon icon;
    readonly ContextMenuStrip menu;
    readonly HotkeyWindow hotkey;
    readonly Icon appIcon;
    bool capturing;
    bool exiting;
    SettingsDialog? settings;

    public TrayApplication()
    {
        appIcon = Program.LoadIcon();
        menu = new ContextMenuStrip();
        menu.Items.Add("Nova captura (Print Screen)", null, (_, _) => StartCapture());
        menu.Items.Add("Configurações…", null, (_, _) => OpenSettings());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Sair", null, (_, _) => ExitThread());
        icon = new NotifyIcon
        {
            Icon = appIcon,
            Text = "Minha Captura — Print Screen",
            ContextMenuStrip = menu,
            Visible = true
        };
        icon.DoubleClick += (_, _) => StartCapture();
        hotkey = new HotkeyWindow(StartCapture);
        UpdateShortcutLabel();
        if (!hotkey.Registered)
        {
            icon.BalloonTipTitle = "Atalho indisponível";
            icon.BalloonTipText = "Outro aplicativo pode estar usando o atalho. Abra Configurações no menu do ícone para escolher outro.";
            icon.ShowBalloonTip(8000);
        }
    }

    void UpdateShortcutLabel()
    {
        menu.Items[0].Text = $"Nova captura ({hotkey.Shortcut.Label})";
        var label = $"Minha Captura — {hotkey.Shortcut.Label}";
        icon.Text = label.Length > 63 ? label[..63] : label;
    }

    void OpenSettings()
    {
        if (settings is not null) { settings.Activate(); return; }
        using var dialog = new SettingsDialog(hotkey.Shortcut, shortcut =>
        {
            hotkey.Change(shortcut);
            UpdateShortcutLabel();
        });
        settings = dialog;
        try { dialog.ShowDialog(); }
        finally { settings = null; }
    }

    async void StartCapture()
    {
        if (capturing || exiting || settings is not null) return;
        capturing = true;
        menu.Items[0].Enabled = false;
        try
        {
            menu.Close();
            await Task.Delay(250);
            if (exiting) return;
            using var selector = new AreaSelector();
            if (selector.ShowDialog() == DialogResult.OK && selector.CapturedImage is { } bitmap)
            {
                using (bitmap)
                using (var editor = new Editor(bitmap)) editor.ShowDialog();
            }
        }
        catch (Exception ex) { MessageBox.Show("Não foi possível capturar a tela: " + ex.Message, "Minha Captura"); }
        finally
        {
            capturing = false;
            if (!exiting) menu.Items[0].Enabled = true;
        }
    }

    protected override void ExitThreadCore()
    {
        exiting = true;
        icon.Visible = false;
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            exiting = true;
            hotkey.Dispose();
            icon.Dispose();
            appIcon.Dispose();
            menu.Dispose();
        }
        base.Dispose(disposing);
    }
}

sealed class HotkeyWindow : NativeWindow, IDisposable
{
    int hotkeyId = 1;
    readonly Action capture;
    public bool Registered { get; private set; }
    public Shortcut Shortcut { get; private set; } = Shortcut.Load();

    public HotkeyWindow(Action capture)
    {
        this.capture = capture;
        CreateHandle(new CreateParams { Parent = new IntPtr(-3) });
        Registered = RegisterHotKey(Handle, hotkeyId, 0x4000 | Shortcut.Modifiers, (uint)Shortcut.Key);
    }

    public void Change(Shortcut shortcut)
    {
        if (!shortcut.IsValid) throw new InvalidOperationException("Escolha uma tecla válida para o atalho.");
        if (shortcut == Shortcut && Registered)
        {
            shortcut.Save();
            return;
        }
        var nextId = hotkeyId == 1 ? 2 : 1;
        if (!RegisterHotKey(Handle, nextId, 0x4000 | shortcut.Modifiers, (uint)shortcut.Key))
            throw new InvalidOperationException("Não foi possível registrar esse atalho. Ele pode estar em uso por outro aplicativo ou reservado pelo Windows. Escolha outra combinação.");
        try { shortcut.Save(); }
        catch
        {
            UnregisterHotKey(Handle, nextId);
            throw;
        }
        if (Registered) UnregisterHotKey(Handle, hotkeyId);
        hotkeyId = nextId;
        Shortcut = shortcut;
        Registered = true;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x0312 && m.WParam.ToInt32() == hotkeyId) capture();
        base.WndProc(ref m);
    }

    public void Dispose()
    {
        if (Handle == IntPtr.Zero) return;
        if (Registered) UnregisterHotKey(Handle, hotkeyId);
        DestroyHandle();
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool UnregisterHotKey(IntPtr window, int id);
}

sealed class AreaSelector : Form
{
    readonly Bitmap desktop;
    Point origin;
    Rectangle selection;
    bool dragging;
    public Bitmap? CapturedImage { get; private set; }

    public AreaSelector()
    {
        var bounds = SystemInformation.VirtualScreen;
        desktop = new Bitmap(bounds.Width, bounds.Height);
        using (var g = Graphics.FromImage(desktop)) g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        Bounds = bounds;
        TopMost = true;
        DoubleBuffered = true;
        Cursor = Cursors.Cross;
        KeyPreview = true;
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };
        MouseDown += (_, e) => { if (e.Button != MouseButtons.Left) return; origin = e.Location; dragging = true; };
        MouseMove += (_, e) => { if (!dragging) return; selection = Rectangle.FromLTRB(Math.Min(origin.X, e.X), Math.Min(origin.Y, e.Y), Math.Max(origin.X, e.X), Math.Max(origin.Y, e.Y)); Invalidate(); };
        MouseUp += (_, e) =>
        {
            if (!dragging || e.Button != MouseButtons.Left) return;
            dragging = false;
            if (selection.Width < 2 || selection.Height < 2) return;
            CapturedImage = desktop.Clone(selection, PixelFormat.Format32bppArgb);
            DialogResult = DialogResult.OK;
        };
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.DrawImageUnscaled(desktop, 0, 0);
        using var shade = new SolidBrush(Color.FromArgb(130, Color.Black));
        e.Graphics.FillRectangle(shade, ClientRectangle);
        if (selection.Width > 0 && selection.Height > 0)
        {
            e.Graphics.DrawImage(desktop, selection, selection, GraphicsUnit.Pixel);
            e.Graphics.DrawRectangle(Pens.DeepSkyBlue, selection);
        }
        e.Graphics.DrawString("Arraste para selecionar • Esc cancela", Font, Brushes.White, 20, 20);
    }

    protected override void Dispose(bool disposing) { if (disposing) desktop.Dispose(); base.Dispose(disposing); }
}

sealed record Mark(string Tool, Color Color, Point[] Points, string Text = "");

sealed class Editor : Form
{
    readonly Bitmap original;
    readonly List<Mark> marks = [];
    readonly List<Point> points = [];
    readonly PictureBox canvas;
    string tool = "Seta";
    Color color = Color.Red;
    Color strokeColor;
    bool drawing;

    public Editor(Bitmap source)
    {
        original = new Bitmap(source);
        Text = "Minha Captura — editor";
        Size = new Size(Math.Min(source.Width + 60, 1200), Math.Min(source.Height + 150, 850));
        MinimumSize = new Size(700, 300);
        StartPosition = FormStartPosition.CenterScreen;
        var toolbar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 76, Padding = new Padding(6), AutoScroll = true };
        foreach (var name in new[] { "Seta", "Retângulo", "Caneta", "Texto" })
        {
            var button = new RadioButton { Text = name, Appearance = Appearance.Button, AutoSize = true, Checked = name == tool };
            button.CheckedChanged += (_, _) => { if (button.Checked) tool = name; };
            toolbar.Controls.Add(button);
        }
        AddButton(toolbar, "Cor", () => { using var dialog = new ColorDialog { Color = color }; if (dialog.ShowDialog() == DialogResult.OK) color = dialog.Color; });
        AddButton(toolbar, "Desfazer", () => { if (marks.Count > 0) { marks.RemoveAt(marks.Count - 1); canvas!.Invalidate(); } });
        AddButton(toolbar, "Copiar", () => { using var result = Render(); Clipboard.SetImage(result); });
        AddButton(toolbar, "Salvar PNG", Save);
        var scroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = Color.FromArgb(40, 40, 40) };
        canvas = new PictureBox { Size = source.Size, Location = Point.Empty };
        canvas.Paint += (_, e) =>
        {
            e.Graphics.DrawImageUnscaled(original, 0, 0);
            foreach (var mark in marks) Draw(e.Graphics, mark);
            if (drawing && points.Count > 1) Draw(e.Graphics, new Mark(tool, strokeColor, points.ToArray()));
        };
        canvas.MouseDown += (_, e) =>
        {
            if (e.Button != MouseButtons.Left) return;
            if (tool == "Texto")
            {
                using var prompt = new Form { Text = "Adicionar texto", ClientSize = new Size(360, 100), StartPosition = FormStartPosition.CenterParent };
                var input = new TextBox { Location = new Point(12, 12), Width = 336 };
                var ok = new Button { Text = "Adicionar", DialogResult = DialogResult.OK, Location = new Point(240, 52) };
                prompt.Controls.AddRange([input, ok]); prompt.AcceptButton = ok;
                if (prompt.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(input.Text)) { marks.Add(new Mark(tool, color, [e.Location], input.Text)); canvas.Invalidate(); }
                return;
            }
            drawing = true; strokeColor = color; points.Clear(); points.Add(e.Location); canvas.Capture = true;
        };
        canvas.MouseMove += (_, e) =>
        {
            if (!drawing) return;
            if (tool != "Caneta" && points.Count > 1) points.RemoveAt(points.Count - 1);
            points.Add(e.Location); canvas.Invalidate();
        };
        canvas.MouseUp += (_, e) =>
        {
            if (!drawing || e.Button != MouseButtons.Left) return;
            if (points.Count > 1) marks.Add(new Mark(tool, strokeColor, points.ToArray()));
            drawing = false; canvas.Capture = false; canvas.Invalidate();
        };
        scroll.Controls.Add(canvas);
        Controls.Add(scroll); Controls.Add(toolbar);
    }

    static void AddButton(Control parent, string label, Action action)
    {
        var button = new Button { Text = label, AutoSize = true };
        button.Click += (_, _) => { try { action(); } catch (Exception ex) { MessageBox.Show("Não foi possível concluir: " + ex.Message); } };
        parent.Controls.Add(button);
    }

    static void Draw(Graphics g, Mark mark)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var pen = new Pen(mark.Color, 3);
        var a = mark.Points[0]; var b = mark.Points[^1];
        switch (mark.Tool)
        {
            case "Seta":
                using (var arrow = new AdjustableArrowCap(5, 6)) { pen.CustomEndCap = arrow; g.DrawLine(pen, a, b); }
                break;
            case "Retângulo": g.DrawRectangle(pen, Math.Min(a.X, b.X), Math.Min(a.Y, b.Y), Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y)); break;
            case "Caneta": if (mark.Points.Length > 1) g.DrawLines(pen, mark.Points); break;
            case "Texto": using (var font = new Font("Segoe UI", 18, FontStyle.Bold)) using (var brush = new SolidBrush(mark.Color)) g.DrawString(mark.Text, font, brush, a); break;
        }
    }

    Bitmap Render()
    {
        var result = new Bitmap(original);
        using var g = Graphics.FromImage(result);
        foreach (var mark in marks) Draw(g, mark);
        return result;
    }

    void Save()
    {
        using var dialog = new SaveFileDialog { Filter = "Imagem PNG|*.png", FileName = $"Captura-{DateTime.Now:yyyyMMdd-HHmmss}.png", DefaultExt = "png", AddExtension = true };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        using var result = Render(); result.Save(dialog.FileName, ImageFormat.Png);
    }

    protected override void Dispose(bool disposing) { if (disposing) original.Dispose(); base.Dispose(disposing); }
}
