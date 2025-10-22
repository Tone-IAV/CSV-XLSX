# Sistema de Avaliação Imobiliária

Aplicação completa para coleta, tratamento e emissão de laudos de avaliação imobiliária conforme ABNT NBR 14.653. O sistema implementa frontend responsivo em HTML, TailwindCSS e JavaScript, backend em Node.js (Express) e persistência em SQLite.

## Recursos principais

- Cadastro completo dividido em 14 seções, acompanhando a estrutura dos modelos RL fornecidos.
- Numeração automática dos laudos (ex.: `RL 001-2025`).
- Salvamento automático em SQLite e cópia local no navegador (LocalStorage).
- Upload de fotografias e documentos com organização automática por número de controle.
- Tabelas para áreas (unidade avaliada) e comparativos de mercado.
- Geração de gráfico de valores comparativos (Chart.js) e mapa interativo com Google Maps.
- Exportação para PDF utilizando pdfmake, mantendo a narrativa técnica exigida em perícias.

## Requisitos

- Node.js 18+
- npm ou yarn

## Instalação

```bash
npm install
```

## Execução em modo desenvolvimento

```bash
npm run dev
```

O servidor será executado na porta `3000`. A aplicação web ficará disponível em `http://localhost:3000`.

## Estrutura de diretórios

- `server.js`: API Express responsável pela geração do número de controle, persistência e upload de arquivos.
- `database/db.js`: inicialização e schema do SQLite.
- `public/`: arquivos estáticos (frontend).
  - `index.html`: layout principal com painel lateral, abas e formulários.
  - `css/style.css`: ajustes visuais complementares.
  - `js/app.js`: lógica completa do frontend (autosave, mapas, gráficos, PDF).
- `uploads/`: criado dinamicamente para armazenar fotos e anexos em subpastas por número de controle.

## Banco de dados

Na primeira execução, o arquivo `database/avaliacoes.db` é criado com as tabelas:

- `avaliacoes`
- `areas`
- `comparativos`
- `fotos`
- `documentos`

## Variáveis importantes

- Para uso do mapa, informe uma chave válida da Google Maps API na seção "Mapa Comparativo". O valor fica salvo em LocalStorage.
- O PDF é gerado em conformidade com os dados preenchidos, incorporando imagens e listando anexos.

## Próximos passos sugeridos

- Implementar autenticação e perfis de acesso.
- Criar dashboard de indicadores (tempo médio de conclusão, valores médios, distribuição por tipo de imóvel).
- Validar campos com máscaras específicas (CPF/CNPJ, CEP, telefone) utilizando bibliotecas especializadas.

