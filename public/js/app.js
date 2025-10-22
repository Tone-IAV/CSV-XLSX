const API_BASE = '/api';
const STORAGE_PREFIX = 'avaliacao-pericial-';

const topics = [
  { id: 'cabecalho', titulo: 'Cabeçalho do Laudo' },
  { id: 'identificacao_imovel', titulo: '1. Identificação do Imóvel' },
  { id: 'identificacao_solicitante', titulo: '2. Identificação do Solicitante' },
  { id: 'localizacao_acessos', titulo: '3. Localização e Acessos' },
  { id: 'caracteristicas_regiao', titulo: '4. Características da Região' },
  { id: 'situacao_terreno', titulo: '5. Situação do Terreno e do Imóvel' },
  { id: 'caracteristicas_construcao', titulo: '6. Características da Construção' },
  { id: 'unidade_avaliada', titulo: '7. Unidade Avaliada' },
  { id: 'calculo_avaliacao', titulo: '8. Cálculo de Avaliação' },
  { id: 'criterios_metodologia', titulo: '9. Critérios Técnicos e Metodologia' },
  { id: 'relatorio_fotografico', titulo: '10. Relatório Fotográfico' },
  { id: 'pesquisa_mercado', titulo: '11. Pesquisa de Mercado' },
  { id: 'mapa_comparativo', titulo: '12. Mapa Comparativo' },
  { id: 'certidao_onus', titulo: '13. Certidão de Ônus Reais' },
  { id: 'espelho_cadastral', titulo: '14. Espelho Cadastral / Imobiliário' },
  { id: 'rodape', titulo: 'Rodapé e Responsáveis Técnicos' }
];

const defaultDados = () => ({
  cabecalho: {
    logotipoUrl: '',
    responsavel: '',
    creci: '',
    art: '',
    dataLaudo: new Date().toISOString().substring(0, 10),
    observacoes: ''
  },
  identificacaoImovel: {
    endereco: '',
    matricula: '',
    proprietario: '',
    tipo: '',
    finalidade: '',
    municipio: '',
    uf: '',
    cartorio: '',
    inscricaoMunicipal: '',
    ocupacao: '',
    coordenadas: ''
  },
  identificacaoSolicitante: {
    nome: '',
    documento: '',
    contato: '',
    endereco: '',
    tipoSolicitante: ''
  },
  localizacaoAcessos: {
    descricao: '',
    viasAcesso: '',
    infraestrutura: '',
    entorno: ''
  },
  caracteristicasRegiao: '',
  situacaoTerreno: '',
  caracteristicasConstrucao: {
    padraoConstrutivo: '',
    materiais: '',
    conservacao: '',
    idadeAparente: '',
    instalacoes: '',
    observacoes: ''
  },
  unidadeAvaliada: {
    descricao: '',
    areaPrivativa: '',
    areaComum: '',
    areaTotal: '',
    observacoes: ''
  },
  calculoAvaliacao: {
    areaTotal: '',
    valorUnitario: '',
    valorTotal: '',
    metodologia: 'Método Comparativo Direto de Dados de Mercado',
    enquadramentoNormas: 'ABNT NBR 14.653 - Avaliação de Bens'
  },
  criteriosMetodologia: '',
  relatorioFotografico: {
    consideracoesGerais: ''
  },
  pesquisaMercado: {
    resumo: '',
    observacoes: ''
  },
  mapaComparativo: {
    latitude: '',
    longitude: '',
    apiKey: ''
  },
  certidaoOnus: {
    observacoes: ''
  },
  espelhoCadastral: {
    observacoes: ''
  },
  rodape: {
    responsavelTecnico: '',
    registroProfissional: '',
    assinaturaDigital: '',
    validadeLaudo: ''
  }
});

let avaliacaoAtual = null;
let dadosAvaliacao = defaultDados();
let areas = [];
let comparativos = [];
let fotos = [];
let documentos = [];
let currentTopic = topics[0].id;
let saveTimeout = null;
let chartInstance = null;
let googleMap = null;
let googleMarkers = [];
let legendasTemporarias = {};

const formContainer = document.querySelector('#formContainer');
const topicMenu = document.querySelector('#topicMenu');
const controleLabel = document.querySelector('#controleLabel');
const modalAvaliacoes = document.querySelector('#modalAvaliacoes');
const listaAvaliacoes = document.querySelector('#listaAvaliacoes');
const buscaInput = document.querySelector('#buscaInput');

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return target;
  const output = Array.isArray(target) ? [...target] : { ...target };
  Object.keys(source).forEach((key) => {
    if (Array.isArray(source[key])) {
      output[key] = source[key].slice();
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
}

function setValue(path, value) {
  const keys = path.split('.');
  let ref = dadosAvaliacao;
  while (keys.length > 1) {
    const key = keys.shift();
    if (!(key in ref)) ref[key] = {};
    ref = ref[key];
  }
  ref[keys[0]] = value;
  scheduleSave();
}

function getValue(path) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : ''), dadosAvaliacao) ?? '';
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(value) {
  if (!value) return '';
  return Number(String(value).replace(/\./g, '').replace(',', '.'));
}

function renderTopics() {
  topicMenu.innerHTML = '';
  const template = document.querySelector('#topicTemplate');
  topics.forEach((topic) => {
    const cloneNode = template.content.cloneNode(true);
    const button = cloneNode.querySelector('button');
    button.dataset.topicId = topic.id;
    button.querySelector('span').textContent = topic.titulo;
    if (topic.id === currentTopic) button.classList.add('bg-slate-800');
    button.addEventListener('click', () => {
      currentTopic = topic.id;
      renderTopics();
      renderCurrentTopic();
    });
    topicMenu.appendChild(cloneNode);
  });
}

function renderCurrentTopic() {
  const topic = topics.find((t) => t.id === currentTopic) || topics[0];
  formContainer.innerHTML = '';
  const section = document.createElement('div');
  section.className = 'section-card';
  section.innerHTML = getTopicContent(topic.id);
  formContainer.appendChild(section);
  attachDynamicHandlers(topic.id);
  if (topic.id === 'pesquisa_mercado') {
    renderComparativosTable();
    renderComparativosChart();
  }
  if (topic.id === 'relatorio_fotografico') {
    renderFotos();
  }
  if (topic.id === 'mapa_comparativo') {
    renderMapa();
  }
  if (topic.id === 'certidao_onus' || topic.id === 'espelho_cadastral') {
    renderDocumentos();
  }
}

function inputField({ label, path, type = 'text', placeholder = '', classes = '' }) {
  const value = getValue(path) ?? '';
  const inputId = `input-${path.replace(/\./g, '-')}`;
  if (type === 'textarea') {
    return `
      <label for="${inputId}">
        <span>${label}</span>
        <textarea id="${inputId}" data-path="${path}" placeholder="${placeholder}" class="w-full">${value || ''}</textarea>
      </label>
    `;
  }
  if (type === 'date') {
    return `
      <label for="${inputId}">
        <span>${label}</span>
        <input type="date" id="${inputId}" data-path="${path}" value="${value || ''}" class="w-full" />
      </label>
    `;
  }
  if (type === 'select') {
    const options = classes
      .split('|')
      .map((option) => option.trim())
      .filter(Boolean)
      .map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`) 
      .join('');
    return `
      <label for="${inputId}">
        <span>${label}</span>
        <select id="${inputId}" data-path="${path}" class="w-full">
          <option value=""></option>
          ${options}
        </select>
      </label>
    `;
  }
  return `
    <label for="${inputId}">
      <span>${label}</span>
      <input type="${type}" id="${inputId}" data-path="${path}" value="${value || ''}" placeholder="${placeholder}" class="w-full" />
    </label>
  `;
}

function getTopicContent(id) {
  switch (id) {
    case 'cabecalho':
      return `
        <h3>Identificação do Laudo</h3>
        <div class="input-grid columns-2">
          ${inputField({ label: 'Responsável Técnico', path: 'cabecalho.responsavel' })}
          ${inputField({ label: 'CRECI / Registro Profissional', path: 'cabecalho.creci' })}
          ${inputField({ label: 'ART/RRT', path: 'cabecalho.art' })}
          ${inputField({ label: 'Data do Laudo', path: 'cabecalho.dataLaudo', type: 'date' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Link do Logotipo (URL)', path: 'cabecalho.logotipoUrl', placeholder: 'https://...' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Observações de Cabeçalho', path: 'cabecalho.observacoes', type: 'textarea' })}
        </div>
      `;
    case 'identificacao_imovel':
      return `
        <h3>1. Identificação do Imóvel</h3>
        <div class="input-grid columns-2">
          ${inputField({ label: 'Endereço completo', path: 'identificacaoImovel.endereco' })}
          ${inputField({ label: 'Proprietário', path: 'identificacaoImovel.proprietario' })}
          ${inputField({ label: 'Tipo de Imóvel', path: 'identificacaoImovel.tipo', placeholder: 'Apartamento, Casa, Terreno...' })}
          ${inputField({ label: 'Finalidade da Avaliação', path: 'identificacaoImovel.finalidade' })}
          ${inputField({ label: 'Matrícula', path: 'identificacaoImovel.matricula' })}
          ${inputField({ label: 'Cartório de Registro', path: 'identificacaoImovel.cartorio' })}
          ${inputField({ label: 'Município', path: 'identificacaoImovel.municipio' })}
          ${inputField({ label: 'UF', path: 'identificacaoImovel.uf' })}
          ${inputField({ label: 'Inscrição Municipal / CCIR', path: 'identificacaoImovel.inscricaoMunicipal' })}
          ${inputField({ label: 'Situação de Ocupação', path: 'identificacaoImovel.ocupacao' })}
          ${inputField({ label: 'Coordenadas Geográficas (se conhecidas)', path: 'identificacaoImovel.coordenadas' })}
        </div>
      `;
    case 'identificacao_solicitante':
      return `
        <h3>2. Identificação do Solicitante</h3>
        <div class="input-grid columns-2">
          ${inputField({ label: 'Nome/Razão Social', path: 'identificacaoSolicitante.nome' })}
          ${inputField({ label: 'CPF/CNPJ', path: 'identificacaoSolicitante.documento' })}
          ${inputField({ label: 'Contato (telefone/email)', path: 'identificacaoSolicitante.contato' })}
          ${inputField({ label: 'Tipo de Solicitante', path: 'identificacaoSolicitante.tipoSolicitante' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Endereço do solicitante', path: 'identificacaoSolicitante.endereco', type: 'textarea' })}
        </div>
      `;
    case 'localizacao_acessos':
      return `
        <h3>3. Localização e Acessos</h3>
        <div class="input-grid">
          ${inputField({ label: 'Descrição da localização', path: 'localizacaoAcessos.descricao', type: 'textarea' })}
          ${inputField({ label: 'Vias de acesso e mobilidade', path: 'localizacaoAcessos.viasAcesso', type: 'textarea' })}
          ${inputField({ label: 'Infraestrutura urbana disponível', path: 'localizacaoAcessos.infraestrutura', type: 'textarea' })}
          ${inputField({ label: 'Entorno imediato', path: 'localizacaoAcessos.entorno', type: 'textarea' })}
        </div>
      `;
    case 'caracteristicas_regiao':
      return `
        <h3>4. Características da Região</h3>
        <div class="input-grid">
          ${inputField({ label: 'Análise socioeconômica, uso e ocupação do solo, vetores de crescimento', path: 'caracteristicasRegiao', type: 'textarea' })}
        </div>
      `;
    case 'situacao_terreno':
      return `
        <h3>5. Situação do Terreno e do Imóvel</h3>
        <div class="input-grid">
          ${inputField({ label: 'Topografia, condições ambientais, benfeitorias e eventuais restrições', path: 'situacaoTerreno', type: 'textarea' })}
        </div>
      `;
    case 'caracteristicas_construcao':
      return `
        <h3>6. Características da Construção</h3>
        <div class="input-grid columns-2">
          ${inputField({ label: 'Padrão construtivo', path: 'caracteristicasConstrucao.padraoConstrutivo' })}
          ${inputField({ label: 'Materiais predominantes', path: 'caracteristicasConstrucao.materiais' })}
          ${inputField({ label: 'Estado de conservação', path: 'caracteristicasConstrucao.conservacao' })}
          ${inputField({ label: 'Idade aparente', path: 'caracteristicasConstrucao.idadeAparente' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Instalações complementares', path: 'caracteristicasConstrucao.instalacoes', type: 'textarea' })}
          ${inputField({ label: 'Observações adicionais', path: 'caracteristicasConstrucao.observacoes', type: 'textarea' })}
        </div>
      `;
    case 'unidade_avaliada':
      return `
        <h3>7. Unidade Avaliada (Áreas)</h3>
        <p class="text-sm text-slate-600">Cadastre os compartimentos ou áreas que compõem a unidade avaliada conforme planilha.</p>
        <div class="flex gap-2 flex-wrap">
          <button id="adicionarArea" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Adicionar área</button>
          <button id="importarAreaCsv" class="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg">Importar CSV</button>
          <input type="file" id="arquivoAreaCsv" accept=".csv" class="hidden" />
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Largura (m)</th>
                <th>Comprimento (m)</th>
                <th>Área (m²)</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="tabelaAreas"></tbody>
          </table>
        </div>
        <div class="input-grid columns-3">
          ${inputField({ label: 'Área privativa total (m²)', path: 'unidadeAvaliada.areaPrivativa' })}
          ${inputField({ label: 'Área comum (m²)', path: 'unidadeAvaliada.areaComum' })}
          ${inputField({ label: 'Área total (m²)', path: 'unidadeAvaliada.areaTotal' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Observações da unidade', path: 'unidadeAvaliada.observacoes', type: 'textarea' })}
        </div>
      `;
    case 'calculo_avaliacao':
      return `
        <h3>8. Cálculo de Avaliação</h3>
        <div class="input-grid columns-3">
          ${inputField({ label: 'Área considerada (m²)', path: 'calculoAvaliacao.areaTotal' })}
          ${inputField({ label: 'Valor unitário (R$/m²)', path: 'calculoAvaliacao.valorUnitario' })}
          ${inputField({ label: 'Valor de mercado (R$)', path: 'calculoAvaliacao.valorTotal' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Metodologia aplicada', path: 'calculoAvaliacao.metodologia', type: 'textarea' })}
          ${inputField({ label: 'Enquadramento normativo', path: 'calculoAvaliacao.enquadramentoNormas', type: 'textarea' })}
        </div>
        <div class="mt-4 p-4 bg-slate-100 rounded-xl text-sm text-slate-600">
          <p><strong>Valores formatados automaticamente:</strong></p>
          <p>Área total informada: <span id="previewAreaTotal">${dadosAvaliacao.calculoAvaliacao.areaTotal}</span> m²</p>
          <p>Valor unitário: <span id="previewValorUnitario">${formatCurrency(dadosAvaliacao.calculoAvaliacao.valorUnitario)}</span></p>
          <p>Valor de mercado estimado: <span id="previewValorTotal">${formatCurrency(dadosAvaliacao.calculoAvaliacao.valorTotal)}</span></p>
        </div>
      `;
    case 'criterios_metodologia':
      return `
        <h3>9. Critérios Técnicos e Metodologia</h3>
        <div class="input-grid">
          ${inputField({ label: 'Descreva os procedimentos adotados, normas consultadas e justificativas técnicas', path: 'criteriosMetodologia', type: 'textarea' })}
        </div>
      `;
    case 'relatorio_fotografico':
      return `
        <h3>10. Relatório Fotográfico</h3>
        <p class="text-sm text-slate-600">Envie as fotografias relevantes com legendas descritivas.</p>
        <form id="formUploadFotos" class="bg-slate-100 rounded-xl p-4 flex flex-col gap-3">
          <div class="flex flex-col md:flex-row gap-3">
            <input type="file" name="fotos" id="inputFotos" class="flex-1" multiple accept="image/*" />
            <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Enviar imagens</button>
          </div>
          <p class="text-xs text-slate-500">As imagens serão armazenadas em /uploads/{controle}/fotos.</p>
        </form>
        <div id="legendasFotos" class="space-y-2"></div>
        <div class="input-grid">
          ${inputField({ label: 'Considerações gerais do registro fotográfico', path: 'relatorioFotografico.consideracoesGerais', type: 'textarea' })}
        </div>
        <div id="galeriaFotos" class="preview-grid"></div>
      `;
    case 'pesquisa_mercado':
      return `
        <h3>11. Pesquisa de Mercado</h3>
        <div class="flex gap-2 flex-wrap">
          <button id="adicionarComparativo" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Adicionar comparativo</button>
        </div>
        <div class="table-wrapper mt-4">
          <table class="data-table">
            <thead>
              <tr>
                <th>Endereço</th>
                <th>Área (m²)</th>
                <th>Valor (R$)</th>
                <th>Link</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="tabelaComparativos"></tbody>
          </table>
        </div>
        <div class="mt-4">
          <canvas id="graficoComparativos" height="220"></canvas>
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Resumo da pesquisa de mercado', path: 'pesquisaMercado.resumo', type: 'textarea' })}
          ${inputField({ label: 'Observações adicionais', path: 'pesquisaMercado.observacoes', type: 'textarea' })}
        </div>
      `;
    case 'mapa_comparativo':
      return `
        <h3>12. Mapa Comparativo</h3>
        <div class="input-grid columns-3">
          ${inputField({ label: 'Latitude do imóvel avaliado', path: 'mapaComparativo.latitude' })}
          ${inputField({ label: 'Longitude do imóvel avaliado', path: 'mapaComparativo.longitude' })}
          ${inputField({ label: 'Google Maps API Key', path: 'mapaComparativo.apiKey', placeholder: 'Somente necessário uma vez' })}
        </div>
        <div id="map" class="map-container mt-4"></div>
        <p class="text-xs text-slate-500 mt-2">Os pontos dos comparativos consideram as coordenadas informadas na pesquisa de mercado.</p>
      `;
    case 'certidao_onus':
      return `
        <h3>13. Certidão de Ônus Reais</h3>
        <form id="formUploadOnus" class="bg-slate-100 rounded-xl p-4 flex flex-col gap-3">
          <input type="file" name="documento" accept="application/pdf,image/*" />
          <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Anexar documento</button>
        </form>
        <div class="input-grid">
          ${inputField({ label: 'Observações', path: 'certidaoOnus.observacoes', type: 'textarea' })}
        </div>
        <div id="listaDocumentosOnus" class="space-y-2"></div>
      `;
    case 'espelho_cadastral':
      return `
        <h3>14. Espelho Cadastral / Imobiliário</h3>
        <form id="formUploadEspelho" class="bg-slate-100 rounded-xl p-4 flex flex-col gap-3">
          <input type="file" name="documento" accept="application/pdf,image/*" />
          <button type="submit" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Anexar documento</button>
        </form>
        <div class="input-grid">
          ${inputField({ label: 'Observações', path: 'espelhoCadastral.observacoes', type: 'textarea' })}
        </div>
        <div id="listaDocumentosEspelho" class="space-y-2"></div>
      `;
    case 'rodape':
      return `
        <h3>Declarações Finais</h3>
        <div class="input-grid columns-2">
          ${inputField({ label: 'Responsável técnico pelo laudo', path: 'rodape.responsavelTecnico' })}
          ${inputField({ label: 'Registro profissional / conselho', path: 'rodape.registroProfissional' })}
        </div>
        <div class="input-grid">
          ${inputField({ label: 'Assinatura digital / Hash', path: 'rodape.assinaturaDigital' })}
          ${inputField({ label: 'Validade do laudo', path: 'rodape.validadeLaudo' })}
        </div>
      `;
    default:
      return '<p>Seção em construção.</p>';
  }
}

function attachDynamicHandlers(topicId) {
  formContainer.querySelectorAll('input[data-path], textarea[data-path], select[data-path]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const path = event.target.dataset.path;
      let value = event.target.value;
      if (path.includes('valor') || path.includes('area')) {
        // manter valores numéricos
      }
      setValue(path, value);
      if (topicId === 'calculo_avaliacao') {
        atualizarResumoCalculo();
      }
      if (topicId === 'mapa_comparativo') {
        renderMapa();
      }
    });
  });

  if (topicId === 'unidade_avaliada') {
    document.querySelector('#adicionarArea').addEventListener('click', (event) => {
      event.preventDefault();
      areas.push({ descricao: '', largura: '', comprimento: '', area: '', tipo: '' });
      renderAreas();
      scheduleSave();
    });
    document.querySelector('#importarAreaCsv').addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelector('#arquivoAreaCsv').click();
    });
    document.querySelector('#arquivoAreaCsv').addEventListener('change', importarAreasCsv);
    renderAreas();
  }

  if (topicId === 'pesquisa_mercado') {
    document.querySelector('#adicionarComparativo').addEventListener('click', (event) => {
      event.preventDefault();
      comparativos.push({ endereco: '', area: '', valor: '', link: '', latitude: '', longitude: '' });
      renderComparativosTable();
      renderComparativosChart();
      scheduleSave();
    });
    renderComparativosTable();
    renderComparativosChart();
  }

  if (topicId === 'relatorio_fotografico') {
    const form = document.querySelector('#formUploadFotos');
    form.addEventListener('submit', uploadFotos);
    const inputFotos = document.querySelector('#inputFotos');
    const legendasContainer = document.querySelector('#legendasFotos');
    legendasTemporarias = {};
    inputFotos.addEventListener('change', () => {
      legendasTemporarias = {};
      legendasContainer.innerHTML = '';
      Array.from(inputFotos.files || []).forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2 md:flex-row md:items-center';
        wrapper.innerHTML = `
          <span class="text-sm font-medium text-slate-700 flex-1">${file.name}</span>
          <input type="text" data-index="${index}" placeholder="Legenda da foto" class="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" />
        `;
        legendasContainer.appendChild(wrapper);
      });
      legendasContainer.querySelectorAll('input[data-index]').forEach((input) => {
        input.addEventListener('input', (event) => {
          legendasTemporarias[event.target.dataset.index] = event.target.value;
        });
      });
    });
  }

  if (topicId === 'certidao_onus') {
    document.querySelector('#formUploadOnus').addEventListener('submit', (event) => uploadDocumento(event, 'certidao_onus'));
  }
  if (topicId === 'espelho_cadastral') {
    document.querySelector('#formUploadEspelho').addEventListener('submit', (event) => uploadDocumento(event, 'espelho_cadastral'));
  }
}

function renderAreas() {
  const tabela = document.querySelector('#tabelaAreas');
  if (!tabela) return;
  tabela.innerHTML = '';
  areas.forEach((area, index) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td><input type="text" value="${area.descricao || ''}" data-index="${index}" data-field="descricao" /></td>
      <td><input type="number" step="0.01" value="${area.largura || ''}" data-index="${index}" data-field="largura" /></td>
      <td><input type="number" step="0.01" value="${area.comprimento || ''}" data-index="${index}" data-field="comprimento" /></td>
      <td><input type="number" step="0.01" value="${area.area || ''}" data-index="${index}" data-field="area" /></td>
      <td><input type="text" value="${area.tipo || ''}" data-index="${index}" data-field="tipo" /></td>
      <td><button data-action="remover" data-index="${index}" class="text-red-500">Remover</button></td>
    `;
    tabela.appendChild(linha);
  });
  tabela.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', (event) => {
      const idx = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      areas[idx][field] = event.target.value;
      if (['largura', 'comprimento'].includes(field)) {
        const largura = parseFloat(areas[idx].largura);
        const comprimento = parseFloat(areas[idx].comprimento);
        if (!Number.isNaN(largura) && !Number.isNaN(comprimento)) {
          areas[idx].area = (largura * comprimento).toFixed(2);
          renderAreas();
        }
      }
      scheduleSave();
    });
  });
  tabela.querySelectorAll('button[data-action="remover"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const idx = Number(event.target.dataset.index);
      areas.splice(idx, 1);
      renderAreas();
      scheduleSave();
    });
  });
}

function importarAreasCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split(/\r?\n/);
    lines.forEach((line) => {
      const [descricao, largura, comprimento, areaValor, tipo] = line.split(';');
      if (descricao) {
        areas.push({ descricao, largura, comprimento, area: areaValor, tipo });
      }
    });
    renderAreas();
    scheduleSave();
  };
  reader.readAsText(file, 'utf-8');
}

function renderComparativosTable() {
  const tabela = document.querySelector('#tabelaComparativos');
  if (!tabela) return;
  tabela.innerHTML = '';
  comparativos.forEach((item, index) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td><input type="text" value="${item.endereco || ''}" data-index="${index}" data-field="endereco" /></td>
      <td><input type="number" step="0.01" value="${item.area || ''}" data-index="${index}" data-field="area" /></td>
      <td><input type="number" step="0.01" value="${item.valor || ''}" data-index="${index}" data-field="valor" /></td>
      <td><input type="url" value="${item.link || ''}" data-index="${index}" data-field="link" /></td>
      <td><input type="text" value="${item.latitude || ''}" data-index="${index}" data-field="latitude" /></td>
      <td><input type="text" value="${item.longitude || ''}" data-index="${index}" data-field="longitude" /></td>
      <td><button class="text-red-500" data-action="remover" data-index="${index}">Remover</button></td>
    `;
    tabela.appendChild(linha);
  });
  tabela.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', (event) => {
      const idx = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      comparativos[idx][field] = event.target.value;
      scheduleSave();
      renderComparativosChart();
      renderMapa();
    });
  });
  tabela.querySelectorAll('button[data-action="remover"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const idx = Number(event.target.dataset.index);
      comparativos.splice(idx, 1);
      renderComparativosTable();
      renderComparativosChart();
      renderMapa();
      scheduleSave();
    });
  });
}

function renderComparativosChart() {
  const canvas = document.querySelector('#graficoComparativos');
  if (!canvas) return;
  const labels = comparativos.map((c, i) => c.endereco || `Comparativo ${i + 1}`);
  const valores = comparativos.map((c) => Number(c.valor) || 0);
  if (chartInstance) {
    chartInstance.destroy();
  }
  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Valor ofertado / negociado',
          data: valores,
          backgroundColor: 'rgba(37, 99, 235, 0.6)'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          ticks: {
            callback: (value) => formatCurrency(value)
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y)
          }
        }
      }
    }
  });
}

async function loadGoogleMaps() {
  const apiKey = dadosAvaliacao.mapaComparativo.apiKey || localStorage.getItem('googleMapsApiKey');
  if (!apiKey) return;
  if (!window.google || !window.google.maps) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Erro ao carregar Google Maps.'));
      document.head.appendChild(script);
    }).catch((error) => console.warn(error));
  }
  localStorage.setItem('googleMapsApiKey', apiKey);
}

async function renderMapa() {
  const mapContainer = document.querySelector('#map');
  if (!mapContainer) return;
  await loadGoogleMaps();
  if (!window.google || !window.google.maps) {
    mapContainer.innerHTML = '<div class="p-4 text-sm text-amber-600">Informe uma chave válida da API do Google Maps para visualizar o mapa.</div>';
    return;
  }
  const lat = parseFloat(dadosAvaliacao.mapaComparativo.latitude);
  const lng = parseFloat(dadosAvaliacao.mapaComparativo.longitude);
  const center = !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : { lat: -15.793889, lng: -47.882778 };
  if (!googleMap) {
    googleMap = new google.maps.Map(mapContainer, {
      center,
      zoom: !Number.isNaN(lat) ? 14 : 4,
      mapTypeId: 'roadmap'
    });
  } else {
    googleMap.setCenter(center);
  }
  googleMarkers.forEach((marker) => marker.setMap(null));
  googleMarkers = [];
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    googleMarkers.push(
      new google.maps.Marker({
        map: googleMap,
        position: { lat, lng },
        title: 'Imóvel avaliado',
        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
      })
    );
  }
  comparativos.forEach((comp, index) => {
    const cLat = parseFloat(comp.latitude);
    const cLng = parseFloat(comp.longitude);
    if (!Number.isNaN(cLat) && !Number.isNaN(cLng)) {
      googleMarkers.push(
        new google.maps.Marker({
          map: googleMap,
          position: { lat: cLat, lng: cLng },
          title: comp.endereco || `Comparativo ${index + 1}`,
          icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        })
      );
    }
  });
}

function renderFotos() {
  const galeria = document.querySelector('#galeriaFotos');
  if (!galeria) return;
  galeria.innerHTML = '';
  if (!fotos.length) {
    galeria.innerHTML = '<p class="text-sm text-slate-500">Nenhuma imagem cadastrada até o momento.</p>';
    return;
  }
  fotos.forEach((foto) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.innerHTML = `
      <img src="/${foto.caminho}" alt="${foto.legenda}" />
      <footer>
        <span>${foto.legenda}</span>
        <button data-id="${foto.id}" class="text-red-500 text-xs">Remover</button>
      </footer>
    `;
    galeria.appendChild(card);
  });
  galeria.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const id = event.target.dataset.id;
      await fetch(`${API_BASE}/fotos/${id}`, { method: 'DELETE' });
      fotos = fotos.filter((foto) => foto.id !== Number(id));
      renderFotos();
    });
  });
}

function renderDocumentos() {
  const onusContainer = document.querySelector('#listaDocumentosOnus');
  const espelhoContainer = document.querySelector('#listaDocumentosEspelho');
  if (onusContainer) {
    onusContainer.innerHTML = '';
    documentos
      .filter((doc) => doc.tipo === 'certidao_onus')
      .forEach((doc) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-slate-100 rounded-lg px-4 py-3 text-sm';
        item.innerHTML = `
          <a href="/${doc.caminho}" target="_blank" class="text-slate-700 underline">${doc.nome_original}</a>
          <button data-id="${doc.id}" class="text-red-500 text-xs">Remover</button>
        `;
        onusContainer.appendChild(item);
      });
    onusContainer.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        const id = event.target.dataset.id;
        await fetch(`${API_BASE}/documentos/${id}`, { method: 'DELETE' });
        documentos = documentos.filter((doc) => doc.id !== Number(id));
        renderDocumentos();
      });
    });
  }
  if (espelhoContainer) {
    espelhoContainer.innerHTML = '';
    documentos
      .filter((doc) => doc.tipo === 'espelho_cadastral')
      .forEach((doc) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-slate-100 rounded-lg px-4 py-3 text-sm';
        item.innerHTML = `
          <a href="/${doc.caminho}" target="_blank" class="text-slate-700 underline">${doc.nome_original}</a>
          <button data-id="${doc.id}" class="text-red-500 text-xs">Remover</button>
        `;
        espelhoContainer.appendChild(item);
      });
    espelhoContainer.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        const id = event.target.dataset.id;
        await fetch(`${API_BASE}/documentos/${id}`, { method: 'DELETE' });
        documentos = documentos.filter((doc) => doc.id !== Number(id));
        renderDocumentos();
      });
    });
  }
}

async function uploadFotos(event) {
  event.preventDefault();
  if (!avaliacaoAtual) return;
  const input = document.querySelector('#inputFotos');
  if (!input.files.length) return;
  const formData = new FormData();
  Array.from(input.files).forEach((file, index) => {
    formData.append('fotos', file);
    if (legendasTemporarias[index]) {
      formData.append(`legenda_${index}`, legendasTemporarias[index]);
    }
  });
  formData.append('controle', avaliacaoAtual.controle);
  formData.append('avaliacaoId', avaliacaoAtual.id);
  const response = await fetch(`${API_BASE}/upload/fotos`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    alert('Não foi possível enviar as imagens.');
    return;
  }
  const result = await response.json();
  const novasFotos = result.fotos.map((foto) => ({
    ...foto,
    caminho: foto.caminho.replace(/\\/g, '/')
  }));
  fotos = [...fotos, ...novasFotos];
  renderFotos();
  input.value = '';
  legendasTemporarias = {};
  const legendasContainer = document.querySelector('#legendasFotos');
  if (legendasContainer) legendasContainer.innerHTML = '';
}

async function uploadDocumento(event, tipo) {
  event.preventDefault();
  if (!avaliacaoAtual) return;
  const input = event.target.querySelector('input[type="file"]');
  if (!input.files.length) return;
  const formData = new FormData();
  formData.append('documento', input.files[0]);
  formData.append('controle', avaliacaoAtual.controle);
  formData.append('avaliacaoId', avaliacaoAtual.id);
  formData.append('tipo', tipo);
  const response = await fetch(`${API_BASE}/upload/documentos`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    alert('Não foi possível enviar o documento.');
    return;
  }
  const doc = await response.json();
  documentos.push({ ...doc, caminho: doc.caminho.replace(/\\/g, '/') });
  renderDocumentos();
  input.value = '';
}

function atualizarResumoCalculo() {
  const area = document.querySelector('#previewAreaTotal');
  const valorUnitario = document.querySelector('#previewValorUnitario');
  const valorTotal = document.querySelector('#previewValorTotal');
  if (area) area.textContent = dadosAvaliacao.calculoAvaliacao.areaTotal || '';
  if (valorUnitario) valorUnitario.textContent = formatCurrency(dadosAvaliacao.calculoAvaliacao.valorUnitario);
  if (valorTotal) valorTotal.textContent = formatCurrency(dadosAvaliacao.calculoAvaliacao.valorTotal);
}

function scheduleSave() {
  if (!avaliacaoAtual) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    salvarLocalmente();
    salvarServidor();
  }, 1000);
}

function salvarLocalmente() {
  if (!avaliacaoAtual) return;
  const payload = {
    dados: dadosAvaliacao,
    areas,
    comparativos,
    atualizadoEm: new Date().toISOString()
  };
  localStorage.setItem(`${STORAGE_PREFIX}${avaliacaoAtual.controle}`, JSON.stringify(payload));
}

async function salvarServidor() {
  if (!avaliacaoAtual) return;
  const payload = {
    dados: dadosAvaliacao,
    areas,
    comparativos
  };
  await fetch(`${API_BASE}/avaliacoes/${avaliacaoAtual.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

async function carregarAvaliacao(id) {
  const response = await fetch(`${API_BASE}/avaliacoes/${id}`);
  if (!response.ok) {
    alert('Não foi possível carregar a avaliação.');
    return;
  }
  const avaliacao = await response.json();
  avaliacaoAtual = {
    id: avaliacao.id,
    controle: avaliacao.controle,
    ano: avaliacao.ano
  };
  dadosAvaliacao = mergeDeep(defaultDados(), avaliacao.dados || {});
  areas = (avaliacao.areas || []).map((area) => ({ ...area }));
  comparativos = (avaliacao.comparativos || []).map((comp) => ({ ...comp }));
  fotos = (avaliacao.fotos || []).map((foto) => ({ ...foto, caminho: foto.caminho.replace(/\\/g, '/') }));
  documentos = (avaliacao.documentos || []).map((doc) => ({ ...doc, caminho: doc.caminho.replace(/\\/g, '/') }));
  restaurarDoLocalStorage(avaliacao.controle);
  controleLabel.textContent = `${avaliacao.controle} - ${dadosAvaliacao.identificacaoImovel?.tipo || ''}`;
  document.querySelector('#duplicarAvaliacaoBtn').disabled = false;
  document.querySelector('#exportarPdfBtn').disabled = false;
  renderTopics();
  renderCurrentTopic();
}

async function criarNovaAvaliacao() {
  const payload = {
    dados: defaultDados(),
    areas: [],
    comparativos: []
  };
  const response = await fetch(`${API_BASE}/avaliacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    alert('Erro ao criar avaliação.');
    return;
  }
  const nova = await response.json();
  await carregarAvaliacao(nova.id);
}

async function duplicarAvaliacao() {
  if (!avaliacaoAtual) return;
  const response = await fetch(`${API_BASE}/avaliacoes/${avaliacaoAtual.id}/duplicar`, { method: 'POST' });
  if (!response.ok) {
    alert('Não foi possível duplicar.');
    return;
  }
  const nova = await response.json();
  await carregarAvaliacao(nova.id);
}

async function listarAvaliacoes(busca = '') {
  const response = await fetch(`${API_BASE}/avaliacoes?busca=${encodeURIComponent(busca)}`);
  const avaliacoes = await response.json();
  listaAvaliacoes.innerHTML = '';
  avaliacoes.forEach((item) => {
    const linha = document.createElement('tr');
    const dados = JSON.parse(item.dados_json || '{}');
    const identificacao = dados.identificacaoImovel || {};
    linha.innerHTML = `
      <td class="py-3 px-3 font-medium text-slate-700">${item.controle}</td>
      <td class="py-3 px-3 text-slate-600">${identificacao.tipo || ''} - ${identificacao.endereco || ''}</td>
      <td class="py-3 px-3 text-slate-500 text-xs">${new Date(item.updated_at).toLocaleString('pt-BR')}</td>
      <td class="py-3 px-3 text-right"><button data-id="${item.id}" class="text-slate-700 underline">Abrir</button></td>
    `;
    listaAvaliacoes.appendChild(linha);
  });
  listaAvaliacoes.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      await carregarAvaliacao(event.target.dataset.id);
      fecharModalAvaliacoes();
    });
  });
}

function abrirModalAvaliacoes() {
  modalAvaliacoes.classList.remove('hidden');
  modalAvaliacoes.classList.add('flex');
  listarAvaliacoes(buscaInput.value);
}

function fecharModalAvaliacoes() {
  modalAvaliacoes.classList.add('hidden');
  modalAvaliacoes.classList.remove('flex');
}

async function fetchImageAsDataURL(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Não foi possível converter imagem', url, error);
    return null;
  }
}

async function exportarPdf() {
  if (!avaliacaoAtual) return;
  const fotosEmbebidas = [];
  for (const foto of fotos) {
    const dataUrl = await fetchImageAsDataURL(`/${foto.caminho}`);
    if (dataUrl) {
      fotosEmbebidas.push({ image: dataUrl, width: 250, margin: [0, 5, 0, 10], caption: foto.legenda });
    }
  }
  let logotipo = null;
  if (dadosAvaliacao.cabecalho.logotipoUrl) {
    logotipo = await fetchImageAsDataURL(dadosAvaliacao.cabecalho.logotipoUrl);
  }
  const docDefinition = {
    pageMargins: [40, 80, 40, 60],
    header: () => ({
      columns: [
        logotipo
          ? { image: logotipo, width: 120 }
          : { text: 'Laudo de Avaliação de Imóvel', bold: true, fontSize: 16 },
        {
          stack: [
            { text: avaliacaoAtual.controle, alignment: 'right', bold: true },
            { text: `Emitido em ${new Date().toLocaleDateString('pt-BR')}`, alignment: 'right', fontSize: 9 }
          ]
        }
      ]
    }),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: dadosAvaliacao.rodape.responsavelTecnico || '', alignment: 'left', fontSize: 9 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 9 }
      ],
      margin: [40, 0, 40, 0]
    }),
    content: [
      { text: '1. Identificação do Imóvel', style: 'sectionTitle' },
      {
        columns: [
          [
            { text: `Endereço: ${dadosAvaliacao.identificacaoImovel.endereco}` },
            { text: `Proprietário: ${dadosAvaliacao.identificacaoImovel.proprietario}` },
            { text: `Tipo de imóvel: ${dadosAvaliacao.identificacaoImovel.tipo}` }
          ],
          [
            { text: `Finalidade: ${dadosAvaliacao.identificacaoImovel.finalidade}` },
            { text: `Matrícula: ${dadosAvaliacao.identificacaoImovel.matricula}` },
            { text: `Cartório: ${dadosAvaliacao.identificacaoImovel.cartorio}` }
          ]
        ]
      },
      { text: '2. Identificação do Solicitante', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: `Solicitante: ${dadosAvaliacao.identificacaoSolicitante.nome}` },
      { text: `Documento: ${dadosAvaliacao.identificacaoSolicitante.documento}` },
      { text: `Contato: ${dadosAvaliacao.identificacaoSolicitante.contato}` },
      { text: '3. Localização e Acessos', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.localizacaoAcessos.descricao, margin: [0, 0, 0, 6] },
      { text: dadosAvaliacao.localizacaoAcessos.viasAcesso, margin: [0, 0, 0, 6] },
      { text: '4. Características da Região', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.caracteristicasRegiao, margin: [0, 0, 0, 6] },
      { text: '5. Situação do Terreno e do Imóvel', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.situacaoTerreno, margin: [0, 0, 0, 6] },
      { text: '6. Características da Construção', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.caracteristicasConstrucao.observacoes, margin: [0, 0, 0, 6] },
      { text: '7. Unidade Avaliada', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      areas.length
        ? {
            table: {
              headerRows: 1,
              widths: ['*', 70, 70, 70, '*'],
              body: [
                ['Descrição', 'Largura', 'Comprimento', 'Área', 'Tipo'],
                ...areas.map((area) => [
                  area.descricao || '',
                  area.largura || '',
                  area.comprimento || '',
                  area.area || '',
                  area.tipo || ''
                ])
              ]
            }
          }
        : { text: 'Sem áreas cadastradas.' },
      { text: '8. Cálculo de Avaliação', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      {
        columns: [
          { text: `Área considerada: ${dadosAvaliacao.calculoAvaliacao.areaTotal} m²` },
          { text: `Valor unitário: ${formatCurrency(dadosAvaliacao.calculoAvaliacao.valorUnitario)}` },
          { text: `Valor total: ${formatCurrency(dadosAvaliacao.calculoAvaliacao.valorTotal)}` }
        ]
      },
      { text: dadosAvaliacao.calculoAvaliacao.metodologia, margin: [0, 6, 0, 6] },
      { text: '9. Critérios Técnicos e Metodologia', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.criteriosMetodologia, margin: [0, 0, 0, 6] },
      { text: '10. Relatório Fotográfico', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: dadosAvaliacao.relatorioFotografico.consideracoesGerais, margin: [0, 0, 0, 6] },
      fotosEmbebidas.length ? { stack: fotosEmbebidas } : { text: 'Sem imagens anexadas.' },
      { text: '11. Pesquisa de Mercado', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      comparativos.length
        ? {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', '*'],
              body: [
                ['Endereço', 'Área (m²)', 'Valor (R$)', 'Link'],
                ...comparativos.map((item) => [
                  item.endereco || '',
                  item.area || '',
                  formatCurrency(item.valor),
                  item.link || ''
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          }
        : { text: 'Sem comparativos cadastrados.' },
      { text: dadosAvaliacao.pesquisaMercado.resumo, margin: [0, 6, 0, 6] },
      { text: '12. Mapa Comparativo', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: `Coordenadas do imóvel: ${dadosAvaliacao.mapaComparativo.latitude}, ${dadosAvaliacao.mapaComparativo.longitude}`, margin: [0, 0, 0, 6] },
      { text: '13. Certidão de Ônus Reais', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      documentos.filter((doc) => doc.tipo === 'certidao_onus').length
        ? {
            ul: documentos
              .filter((doc) => doc.tipo === 'certidao_onus')
              .map((doc) => `${doc.nome_original} - disponível em ${location.origin}/${doc.caminho}`)
          }
        : { text: 'Sem documentos anexados.' },
      { text: '14. Espelho Cadastral', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      documentos.filter((doc) => doc.tipo === 'espelho_cadastral').length
        ? {
            ul: documentos
              .filter((doc) => doc.tipo === 'espelho_cadastral')
              .map((doc) => `${doc.nome_original} - disponível em ${location.origin}/${doc.caminho}`)
          }
        : { text: 'Sem documentos anexados.' },
      { text: 'Rodapé', style: 'sectionTitle', margin: [0, 12, 0, 4] },
      { text: `Responsável Técnico: ${dadosAvaliacao.rodape.responsavelTecnico}` },
      { text: `Registro Profissional: ${dadosAvaliacao.rodape.registroProfissional}` },
      { text: `Validade do Laudo: ${dadosAvaliacao.rodape.validadeLaudo}` }
    ],
    styles: {
      sectionTitle: {
        fontSize: 12,
        bold: true
      }
    }
  };
  pdfMake.createPdf(docDefinition).download(`${avaliacaoAtual.controle.replace(/\s+/g, '_')}.pdf`);
}

function restaurarDoLocalStorage(controle) {
  const data = localStorage.getItem(`${STORAGE_PREFIX}${controle}`);
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    dadosAvaliacao = mergeDeep(defaultDados(), parsed.dados || {});
    areas = Array.isArray(parsed.areas) ? parsed.areas : areas;
    comparativos = Array.isArray(parsed.comparativos) ? parsed.comparativos : comparativos;
  } catch (error) {
    console.warn('Não foi possível restaurar dados locais', error);
  }
}

// Listeners globais
document.querySelector('#novaAvaliacaoBtn').addEventListener('click', criarNovaAvaliacao);
document.querySelector('#duplicarAvaliacaoBtn').addEventListener('click', duplicarAvaliacao);
document.querySelector('#exportarPdfBtn').addEventListener('click', exportarPdf);
document.querySelector('#abrirModalAvaliacoes').addEventListener('click', abrirModalAvaliacoes);
document.querySelector('#fecharModalAvaliacoes').addEventListener('click', fecharModalAvaliacoes);
buscaInput.addEventListener('input', (event) => listarAvaliacoes(event.target.value));

renderTopics();
renderCurrentTopic();
listarAvaliacoes();
