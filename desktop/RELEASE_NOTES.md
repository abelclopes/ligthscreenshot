# ligthscreenshot 0.2.0 — prévia multiplataforma

Nova edição para Linux x64, macOS Intel / Apple Silicon e Windows x64, com interface Electron. A versão Windows Forms 0.1.0 continua disponível separadamente.

- Bandeja / barra de menus e atalho global configurável.
- Captura de tela e seleção de área na imagem capturada.
- Setas, retângulos, desenho livre, texto, cores e desfazer anotações.
- Copiar imagem e salvar em PNG, sem upload pelo aplicativo.

## Escolher o pacote

- **Windows x64:** `.exe` portátil.
- **Linux x64:** `.deb` para Debian/Ubuntu compatíveis, `.AppImage` ou `.tar.gz` portátil.
- **macOS Apple Silicon:** arquivo com `arm64` no nome, em `.dmg` ou `.zip`.
- **macOS Intel:** arquivo com `x64` no nome, em `.dmg` ou `.zip`.

`SHA256SUMS.txt` contém os checksums dos pacotes.

## Permissões e limites desta prévia

No macOS, autorize Gravação de Tela e reinicie o aplicativo. O atalho padrão é Ctrl + Shift + S. Há assinatura ad hoc para integridade local, mas não assinatura Developer ID nem notarização; o Gatekeeper pode impedir a abertura. O projeto não fornece comandos para desativar as proteções do sistema.

No Linux Wayland, a captura e o atalho dependem dos portais do desktop. O sistema pode abrir um seletor de tela e pedir autorização. Pode ser necessário definir a combinação nas configurações do desktop. Prefira o `.deb` onde compatível para instalar a identidade de portal. Se o atalho não funcionar, use Nova captura na janela. AppImage pode exigir FUSE. GNOME pode precisar de AppIndicator para mostrar a bandeja.

Não é uma atualização com equivalência completa à interface Windows Forms: a seleção ocorre sobre a imagem capturada, e não por sobreposição na área de trabalho. Cada tela é editada separadamente. Recorte não tem histórico de desfazer. Não há desfoque nem inicialização automática.

Os testes automatizados verificam recorte, ferramentas de anotação, desfazer, PNG e persistência de preferências em cada sistema, inclusive nos aplicativos empacotados. Eles não substituem teste manual da captura real, permissões, bandeja e atalhos em cada desktop. Esta versão deve ser tratada como experimental.

Código sob licença MIT. Consulte `desktop/README.md` para desenvolvimento e requisitos.
