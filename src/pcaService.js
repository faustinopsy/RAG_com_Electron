import PCA from 'pca-js';

let cachedPlotData = null;


export function getCachedPlotData() {
  return cachedPlotData;
}

/**
 * Calcula o PCA em background e guarda em cache.
 * @param {object} db - A ligação à base de dados LanceDB.
 */
export async function calculateAndCachePCA(db) {
  try {
    if (!db) {
        console.warn('[PCA] A base de dados não está pronta, a saltar o cálculo.');
        return;
    }
    const plotData = await getAllVectors3D(db);
    cachedPlotData = plotData;
    console.log(`[PCA] Dados 3D pré-calculados e guardados em cache.`);
  } catch (error) {
    console.error('[PCA] Falha ao pré-calcular os dados 3D:', error);
  }
}

/**
 * A função principal que faz o trabalho pesado de calcular o PCA.
 * @param {object} db - A ligação à base de dados LanceDB.
 */
async function getAllVectors3D(db) {
  if (!db) {
    throw new Error('Base de dados não inicializada.');
  }
  console.log('[PCA] A carregar todos os vetores da base de dados...');
  
  const table = await db.openTable('documentos');
  const allData = await table.query().limit(50).toArray();

  const validData = allData

  if (validData.length === 0) {
    console.log('[PCA] Nenhum vetor válido encontrado.'); 
    return { x: [], y: [], z: [], text: [] };
  }

  const vectors = validData.map(d => d.vector); // N x 384 dimensões
  const labels = validData.map(d => d.text);    // N x textos

  // Executar o PCA (de 384D para 3D)
  console.log(`[PCA] A reduzir ${vectors.length} vetores válidos de 384D para 3D...`);
  const reducedVectors = PCA.computeAdjustedData(vectors, 3).data;
  
  console.log('[PCA] Redução concluída.');

  // Formatar para o Plotly
  const plotData = {
    x: reducedVectors.map(v => v[0]), // Eixo X
    y: reducedVectors.map(v => v[1]), // Eixo Y
    z: reducedVectors.map(v => v[2]), // Eixo Z
    text: labels // O texto que aparece ao passar o rato
  };

  return plotData;
}