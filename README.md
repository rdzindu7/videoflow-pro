# VideoFlow Pro

Site completo de **organização e postagem** de vídeos em **9:16** com capas luxury cars, legendas virais, agenda **3 posts/dia** no **TikTok + Instagram**, anti re-post, boost de views e preview real.

## Live demo

Após o deploy: `https://<seu-usuario>.github.io/videoflow-pro/`

## Funcionalidades

- **Editor Pro**: play/pause, timeline, fullscreen, filtros, velocidade
- **Áudio**: silenciar um ou **todos** os vídeos, importar música, volumes separados
- **Export 9:16**: Full HD 1080p · QHD · **4K** · **8K** (projeto JSON de render)
- **Ver vídeos**: importe MP4 e assista no player vertical
- **IA de descrições**: motor com score de viralidade (viral / luxury / story / CTA)
- **IA de edição**: presets cinematic, night, slow-mo, punchy + sugestões
- Capas automáticas **9:16** luxury cars
- Agenda **3 posts/dia** TikTok + Instagram · anti re-post
- Preview real TT/Reels · boost de views · localStorage

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
