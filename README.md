# VideoFlow Pro

Site completo de **organização e postagem** de vídeos em **9:16** com capas luxury cars, legendas virais, agenda **3 posts/dia** no **TikTok + Instagram**, anti re-post, boost de views e preview real.

## Live demo

Após o deploy: `https://<seu-usuario>.github.io/videoflow-pro/`

## Funcionalidades

- Biblioteca de vídeos (catálogo + importação local de MP4)
- Capas automáticas **9:16** (carros em lugares ultra-ricos)
- Geração de legendas virais e hashtags
- Agenda automática **3 vídeos por dia** (11:00 · 15:30 · 20:00)
- Anti re-post (não publica de novo o que já saiu)
- Conexão de contas TikTok e Instagram (fluxo de permissões)
- Preview estilo tela real TikTok / Instagram Reels
- Estúdio com marcações + chat IA
- Analytics e **boost** de views
- Dados salvos no `localStorage` do navegador

## Como usar

1. Abra o site
2. Clique em **Abrir painel**
3. **Importar** seus MP4 (arraste da pasta `trabalho`)
4. Conecte TikTok e Instagram
5. **Gerar dia (3)** → Processar fila

## Deploy (GitHub Pages)

```bash
# na pasta site/
git init
git add .
git commit -m "VideoFlow Pro site"
gh repo create videoflow-pro --public --source=. --remote=origin --push
gh api repos/:owner/videoflow-pro/pages -X POST -f build_type=workflow -f source[branch]=main -f source[path]=/
```

Ou: **Settings → Pages → Deploy from branch `main` / root**.

## Nota sobre APIs reais

Publicação real no TikTok/Instagram exige apps oficiais:

- [TikTok for Developers](https://developers.tiktok.com/)
- [Meta Graph API / Instagram](https://developers.facebook.com/)

Este site entrega a operação completa (capas, legendas, fila, anti-dupe, analytics) e simula o envio até as chaves API serem conectadas.

## Licença

Uso pessoal / portfolio.
