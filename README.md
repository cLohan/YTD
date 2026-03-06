# YTD Texture Optimizer
## PT-BR
YTD Texture Optimizer é uma ferramenta desktop para abrir, visualizar e otimizar texturas de arquivos `.ytd` (GTA V), com foco em fluxo rápido, controle de qualidade e exportação prática.

### Sobre o projeto
Este é um projeto **open source**, desenvolvido **100% com IA**, sem propósito lucrativo.
A ideia é simples: compartilhar conhecimento, facilitar o trabalho da comunidade e evoluir a ferramenta em conjunto.

Se você quiser melhorar algo, corrigir bugs, adicionar recursos ou refinar o código, sua contribuição é muito bem-vinda.
Cada melhoria ajuda todo mundo.

### Recursos principais
- Importação de um ou múltiplos YTDs
- Preview `Original`, `Optimized` e `Compare side by side`
- Processamento por textura, por seleção ou em lote
- Exportação de textura individual em `DDS` ou `PNG`
- Exportação de YTD otimizado
- Controle de mipmaps (manter original, gerar, níveis)
- Exclusões por lista/padrões
- Undo após processamento

### Encoders suportados
- `CodeWalker + SharpDX` (interno)
- `ImageMagick`
- `DirectXTex (texconv)`
- `NVIDIA Texture Tools CLI (nvcompress)`

### Requisitos (uso)
- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime
- .NET Desktop Runtime 8.x (x64)

### Requisitos (desenvolvimento)
- Node.js + npm
- Rust toolchain (`cargo`)
- .NET SDK 8.x
- Dependências do Tauri para Windows

### Como usar
1. Abra o app (`ytd-texture-optimizer.exe` ou `run_portable.bat`)
2. Clique em **Open YTD(s)** e selecione os arquivos
3. Ajuste encoder, resize, formato DDS e mipmaps
4. Clique em **Process Selected** ou **Process All YTDs**
5. Exporte texturas ou YTD otimizado

### Rodar em desenvolvimento
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
dotnet build src-tauri/sidecars/YtdCore/YtdCore.csproj -c Release
cd src-tauri
..\node_modules\.bin\tauri.cmd build --no-bundle
```

### Estrutura (resumo)
- `src/` UI React
- `src-tauri/src/` backend Tauri
- `src-tauri/sidecars/YtdCore/` motor de processamento YTD/DDS
- `target/release/` binário release
- `target/share/` pacote portátil para distribuição

---

## EN
YTD Texture Optimizer is a desktop tool to open, preview, and optimize `.ytd` texture files (GTA V), focused on fast workflow, quality control, and practical export.

### About this project
This is an **open-source** project, built **100% with AI**, with no profit-oriented purpose.
The goal is to share knowledge, help the community, and improve the tool together.

If you want to improve anything, fix bugs, add features, or refine the code, your contribution is welcome.
Every improvement helps everyone.

### Main features
- Import one or multiple YTD files
- `Original`, `Optimized`, and `Compare side by side` preview
- Per-texture, selected, or batch processing
- Single texture export as `DDS` or `PNG`
- Optimized YTD export
- Mipmap controls (keep original, generate, custom levels)
- Exclusion list/patterns
- Undo after processing

### Supported encoders
- `CodeWalker + SharpDX` (internal)
- `ImageMagick`
- `DirectXTex (texconv)`
- `NVIDIA Texture Tools CLI (nvcompress)`

### Requirements (runtime)
- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime
- .NET Desktop Runtime 8.x (x64)

### Requirements (development)
- Node.js + npm
- Rust toolchain (`cargo`)
- .NET SDK 8.x
- Tauri dependencies for Windows

### How to use
1. Open the app (`ytd-texture-optimizer.exe` or `run_portable.bat`)
2. Click **Open YTD(s)** and select files
3. Configure encoder, resize, DDS format, and mipmaps
4. Click **Process Selected** or **Process All YTDs**
5. Export textures or optimized YTD

### Run in development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
dotnet build src-tauri/sidecars/YtdCore/YtdCore.csproj -c Release
cd src-tauri
..\node_modules\.bin\tauri.cmd build --no-bundle
```

### Project structure (summary)
- `src/` React UI
- `src-tauri/src/` Tauri backend
- `src-tauri/sidecars/YtdCore/` YTD/DDS processing engine
- `target/release/` release binary
- `target/share/` portable distribution package

## Screenshots
<img width="1919" height="1040" alt="image" src="https://github.com/user-attachments/assets/fe44772c-62ba-4548-a705-0872906f21c6" />
<img width="1915" height="1012" alt="image" src="https://github.com/user-attachments/assets/bd68cba7-c13c-4ae0-99c6-e9aea55dc38a" />
