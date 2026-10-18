# NLinux — página oficial

Este repositório é o código da **página oficial do NLinux**, publicada pelo GitHub Pages em
<https://nilsonlinux.github.io/>.

O site é estático (HTML + CSS + JS, sem etapa de build): o que está no branch `main` é o que
está no ar. O **NLinux** é uma distribuição Linux baseada no **Arch Linux**, com desktop
Wayland **Umbriel + Noctalia** e um **instalador visual em 10 etapas** — a ISO gera um ambiente
ao vivo que boota direto no desktop e instala por uma interface web no navegador.

---

## A ISO — release `2026.10.15`

| | |
|---|---|
| Arquivo | `nlinux-2026.10.15-x86_64.iso` |
| Tamanho | 3 096 641 536 bytes (~2,9 GiB) |
| Arquitetura | `x86_64` |
| Data | 15 de outubro de 2026 |
| Download | [Google Drive](https://drive.google.com/file/d/1OGHENI3Fs6Up4eLDzPFMtUIGkut3XqV2/view?usp=sharing) |
| sha256 | `ec807478bfe6ef9b1b9bb837de6213e1b08ab32b7abf2a3ff29caff762ebe55b` |

### O que a ISO contém

- **Base Arch Linux** (perfil `archiso`/`releng`), bootando **direto no desktop ao vivo** —
  não existe modo separado de instalação por texto no console.
- **Umbriel** (compositor Wayland) + **Noctalia V5** (shell/desktop) + **greetd** com
  `noctalia-greeter` para a tela de login.
- **Instalador web em 10 etapas** (janela kiosk no navegador, em pt-BR e mais 6 idiomas):
  idioma/teclado/fuso, disco, dual boot, sistema de arquivos, espelho, modo, LUKS2, GPU,
  usuário/senha e resumo — com painel de progresso ao vivo.
- **Dois modos de instalação**: **Rápido offline** (padrão, copia o sistema do pendrive, sem
  internet) e **Completo online** (`pacstrap` dos pacotes + AUR via `yay`).
- **Armazenamento**: `systemd-boot`, `ext4` ou `btrfs` (subvolumes `@`, `@home`, `@log`,
  `@pkg`) e criptografia **LUKS2** opcional.
- **NLinux Software** — loja embarcada (`PackageKit` + `AppStream` + `Flathub`).
- **opencode** — agente de programação com IA, **pré-instalado** no ambiente ao vivo e no
  sistema instalado, com atalho na lista de aplicativos (abre no kitty).
- **Aplicativos do desktop**: Firefox, kitty, fish + starship, fastfetch, Nautilus,
  GNOME Text Editor, Spotify, Discord, Telegram Desktop, gpu-screen-recorder,
  mpv/ffmpeg/imagemagick, Flatpak/PackageKit/AppStream.
- **Repositórios do pacman**: `core`, `extra` e `multilib` (de onde sai o Steam).
- **Branding NLinux** no `/etc/os-release`, `/etc/issue`, `/etc/motd`, no menu de boot e no
  rótulo da partição.

### Requisitos e acesso

- `x86_64`, pendrive de **8 GB ou mais**.
- **UEFI é necessário para instalar**; as opções de boot por BIOS servem para experimentar o
  ambiente ao vivo.
- Internet: opcional no modo Rápido offline; necessária no modo Completo online.
- Login do ambiente ao vivo: usuário **`nlinux`**, senha **`nlinux`**.

### Como conferir o download

```bash
sha256sum nlinux-2026.10.15-x86_64.iso
# ec807478bfe6ef9b1b9bb837de6213e1b08ab32b7abf2a3ff29caff762ebe55b
```

---

## Estrutura do site

```
index.html          home (nome do hero desenhado em <canvas>)
baixar.html         download da ISO (link, data, sha256 e contagem de cliques)
changelog.html      releases, puxadas da API do GitHub
docs.html           documentação da distro
recursos.html       recursos do sistema
loja.html           catálogo da loja NLinux Software
compilar.html       como compilar a ISO
plugins.html        plugins públicos do projeto
doar.html           apoio ao projeto
nlinux.html         redireciona para a home
js/site.js          fonte única da verdade: URL/data/sha256 da ISO, catálogo da loja,
                    estrelas do GitHub, contagem de downloads e tooltips
js/hero-name.js     efeito do nome do hero (fonte Metal Mania) no <canvas>
js/galeria.js       galeria de imagens do instalador
css/, img/          estilos e imagens
plugins/, scripts/  páginas de plugins e utilitários de sincronização
data/               dados auxiliares (reações do GitHub)
.github/workflows/  automações do repositório
```

Para publicar uma ISO nova, troque **somente** as três linhas de dados no topo do
`js/site.js` (link, data e sha256): todo elemento marcado no HTML com `[data-iso-download]`,
`[data-iso-date]` ou `[data-iso-sha256]` recebe o valor automaticamente.

Para pré-visualizar localmente:

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

---

## Links

- Site: <https://nilsonlinux.github.io/>
- Build da ISO / instalador: <https://github.com/Nilsonlinux/nlinux-iso-build>
- Loja NLinux Software: <https://github.com/Nilsonlinux/nlinux-software>

## Licença

**GPL-3.0-or-later** — veja [LICENSE](LICENSE).
