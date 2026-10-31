# ligthscreenshot — edição multiplataforma 0.2.0

Prévia para Windows x64, Linux x64 e macOS Intel / Apple Silicon. Esta edição usa Electron e não requer .NET. A versão Windows Forms 0.1.0 permanece no projeto raiz e na release anterior.

## Desenvolvimento

Instale Node.js 24 ou superior e execute nesta pasta:

```sh
npm ci
npm test
npm start
```

`npm run smoke` testa recorte, quatro ferramentas de anotação, desfazer, exportação PNG e persistência de preferências em uma pasta temporária isolada. Não captura a tela real nem altera as preferências do usuário. No Linux sem sessão gráfica: `xvfb-run -a npm run smoke`.

## Usar

Abra o aplicativo. No Windows e macOS, ele fica na bandeja / barra de menus. No Linux, uma janela também é aberta porque nem todo desktop mostra ícones de bandeja. **Nova captura** obtém as telas disponíveis; escolha uma delas e arraste na imagem para recortar. A imagem usa os pixels capturados, independentemente do tamanho de exibição na janela. Depois use seta, retângulo, caneta ou texto. O texto é inserido no campo da barra antes de clicar na imagem.

**Configurações** permite combinar Ctrl, Alt, Shift e Super (Win / Command). Padrão: Print Screen no Windows/Linux; Ctrl + Shift + S no macOS. Atalhos ocupados são informados e a configuração anterior é preservada. Durante a configuração, novas capturas ficam suspensas. Preferências ficam no diretório `userData` do Electron, separado das preferências da versão Windows Forms.

Fechar a janela mantém o aplicativo na bandeja quando disponível. Para encerrar, use **Sair**. Em desktops sem bandeja funcional, mantenha a janela aberta ou encerre pelo botão Sair.

## Particularidades dos sistemas

- **macOS:** permita Gravação de Tela em Ajustes do Sistema → Privacidade e Segurança, e reinicie o aplicativo. Os pacotes não são assinados nem notarizados; o macOS pode impedir a primeira abertura. Gere uma distribuição assinada para evitar esse bloqueio. DMG contém o aplicativo para copiar a Aplicativos. Intel e Apple Silicon têm pacotes separados.
- **Linux X11:** o atalho pode estar ocupado pela ferramenta de captura do desktop. Configure outra combinação. GNOME pode precisar de uma extensão de AppIndicator para mostrar a bandeja.
- **Linux Wayland:** captura e atalhos dependem dos portais do desktop (`xdg-desktop-portal` e backend correspondente). O seletor de telas / autorização pertence ao sistema; pode haver apenas uma tela disponibilizada por captura. O registro do atalho pode exigir confirmação posterior nas configurações do desktop. Em desktops incompatíveis, use Nova captura na janela. Instale o pacote `.deb` em distribuições Debian/Ubuntu compatíveis para registrar a identidade `.desktop`; pacotes portáteis podem não ter identidade de portal instalada.
- **Linux portátil:** AppImage pode exigir FUSE; use o `.deb` ou extraia o `.tar.gz` e execute `./io.github.abelclopes.ligthscreenshot`. O aplicativo precisa de sessão gráfica e bibliotecas de desktop GTK/NSS/GBM/ALSA. Não execute como root nem desative o sandbox para uso normal.

Não há upload, telemetria ou atualizador automático implementado. O acesso HTTP(S) do renderer é bloqueado. Copiar usa a área de transferência, cujo histórico e sincronização são controlados pelo sistema.

## Pacotes

```sh
npm run dist -- --win --x64
npm run dist -- --linux --x64
npm run dist -- --mac --arm64
npm run dist -- --mac --x64
```

Execute no sistema operacional de destino, especialmente para macOS. O workflow **Desktop multiplataforma** compila e testa nas quatro combinações e disponibiliza os pacotes como artifacts. Execute `node scripts/checksums.cjs` após empacotar para gerar `dist/SHA256SUMS.txt`.

Os testes automatizados não comprovam permissões, atalhos globais, qualidade da captura real ou integração da bandeja em todos os desktops. Esses fluxos precisam de teste manual antes de promover a prévia a versão estável. Ainda não há seleção de área por sobreposição na tela, recorte desfeito por histórico, desfoque ou captura abrangendo várias telas em uma única imagem.
