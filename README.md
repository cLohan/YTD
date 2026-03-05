# YTD Texture Optimizer

Ferramenta desktop para abrir, visualizar e otimizar texturas de arquivos `.ytd` (GTA V), com foco em fluxo rápido, controle de qualidade e exportação prática.

## Preview
- Importação de 1 ou múltiplos YTDs
- Preview `Original`, `Optimized` e `Compare side by side`
- Processamento por textura, seleção ou lote completo
- Exportação de textura individual em `DDS` ou `PNG`
- Exportação de YTD otimizado com opções de backup e CSV

## Recursos principais
- Hierarquia de YTD/texturas com seleção em massa
- Exclusões por lista/padrões
- Redimensionamento (dimensões customizadas, percentual, manter original)
- Mipmaps (manter original, gerar automaticamente, níveis customizados)
- Detecção e uso de encoders externos
- Undo após processamento

## Encoders suportados
- `CodeWalker + SharpDX` (interno)
- `ImageMagick`
- `DirectXTex (texconv)`
- `NVIDIA Texture Tools CLI (nvcompress)`

No pacote `share` já gerado pelo projeto, os encoders externos podem ser incluídos para rodar direto em outro PC.

## Requisitos
### Para uso (app release)
- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime
- .NET Desktop Runtime 8.x (x64)

### Para desenvolvimento
- Node.js + npm
- Rust toolchain (cargo)
- .NET SDK 8.x
- Dependências do Tauri para Windows

## Como usar (usuário final)
1. Abra o app (`ytd-texture-optimizer.exe` ou `run_portable.bat` no `share`)
2. Clique em **Open YTD(s)** e selecione seus arquivos
3. Ajuste encoder, resize, formato DDS e mipmaps
4. Clique em **Process Selected** ou **Process All YTDs**
5. Exporte:
   - Textura individual (`DDS`/`PNG`) pelo menu da textura
   - YTD otimizado pelo botão **Export YTD**

## Como rodar em modo desenvolvimento
```bash
npm install
npm run dev
```

## Build
### Frontend
```bash
npm run build
```

### Sidecar (.NET)
```bash
dotnet build src-tauri/sidecars/YtdCore/YtdCore.csproj -c Release
```

### App Tauri (release)
```bash
cd src-tauri
..\node_modules\.bin\tauri.cmd build --no-bundle
```

## Estrutura (resumo)
- `src/` UI React (painéis, store, preview, ações)
- `src-tauri/src/` backend Tauri (comandos, sidecar bridge)
- `src-tauri/sidecars/YtdCore/` motor de processamento YTD/DDS
- `target/release/` binário gerado
- `target/share/` pacote portátil para distribuição

## Roadmap curto
- Mais validações automáticas de textura/formato
- Mais diagnósticos visuais no preview comparativo
- Melhorias de performance em lotes grandes

## Licença
Defina aqui a licença do projeto (ex.: MIT).

---

## English (short)

Desktop app to open, preview and optimize GTA V `.ytd` textures.

### Requirements
- Windows 10/11 x64
- WebView2 Runtime
- .NET Desktop Runtime 8.x

### Quick start
1. Open app
2. Import YTD files
3. Configure encoder/resize/mipmaps
4. Process selected/all
5. Export textures or optimized YTD
