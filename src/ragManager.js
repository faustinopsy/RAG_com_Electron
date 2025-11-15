import { pipeline, env } from '@xenova/transformers';
import { connect } from '@lancedb/lancedb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';   
import path from 'path';
import { PDFParse } from 'pdf-parse';
import PCA from 'pca-js';
import { app } from 'electron';

env.allowLocalModels = true;
env.useBrowserCache = false;

let db;
let embedder;
let generator;
let cachedPlotData = null;

export async function getAllVectors3D() {
  if (!db) {
    throw new Error('Base de dados não inicializada.');
  }
  console.log('[PCA] A carregar todos os vetores da base de dados...');
  
  const table = await db.openTable('documentos');
  const allData = await table.query().toArray();

  // --- NOSSA CORREÇÃO DE "VALID MATRIX" ---
  // 1. Filtrar dados corrompidos
  const validData = allData.filter(d => 
      d.vector && 
      Array.isArray(d.vector) && 
      d.vector.length === 384
  );
  // ------------------------------------

  if (validData.length === 0) {
    console.log('[PCA] Nenhum vetor válido encontrado.');
    return { x: [], y: [], z: [], text: [] };
  }

  // 2. Separar os dados limpos
  const vectors = validData.map(d => d.vector); // N x 384 dimensões
  const labels = validData.map(d => d.text);    // N x textos

  // 3. Executar o PCA (de 384D para 3D)
  console.log(`[PCA] A reduzir ${vectors.length} vetores válidos de 384D para 3D...`);
  const reducedVectors = PCA.computeAdjustedData(vectors, 3).data;
  
  console.log('[PCA] Redução concluída.');

  // 4. Formatar para o Plotly
  const plotData = {
    x: reducedVectors.map(v => v[0]), // Eixo X
    y: reducedVectors.map(v => v[1]), // Eixo Y
    z: reducedVectors.map(v => v[2]), // Eixo Z
    text: labels // O texto que aparece ao passar o rato
  };

  return plotData;
}

async function calculateAndCachePCA() {
  try {
    const plotData = await getAllVectors3D();
    cachedPlotData = plotData;
    console.log(`[PCA] Dados 3D pré-calculados e guardados em cache.`);
  } catch (error) {
    console.error('[PCA] Falha ao pré-calcular os dados 3D:', error);
  }
}

export async function initializeRAG() {
    try {
        console.log('Fase 1: Iniciando o Cérebro RAG...');
        const dbPath = './data/lancedb';
        db = await connect(dbPath);
        console.log(`Conectado ao LanceDB em: ${dbPath}`);
        // 2. Definir o schema (384 dimensões para este modelo)
        const sampleData = [{
            vector: Array(384).fill(0), // Um array de 384 números (float32)
            text: "amostra"                 // Um texto (string)
        }];
        // 3. Tentar criar a tabela 'documentos'
        try {
            await db.createTable('documentos', sampleData);
            console.log('Tabela "documentos" criada com sucesso.');
        } catch (e) {
            console.log('Tabela "documentos" já existe. Abrindo...');
            await db.openTable('documentos');
        }
        // 4. Carregar o modelo de embedding (pode demorar na 1ª vez)
        const modelsPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'models')
        : path.join(app.getAppPath(), 'public', 'models');

        console.log('Carregando modelo de embedding (Local)...');
        const embedderPath = path.join(modelsPath, 'all-MiniLM-L6-v2'); // Mudança: Nome da pasta real
        embedder = await pipeline('feature-extraction', embedderPath);
        console.log('Modelo de embedding carregado.');
        
        console.log('Carregando modelo de geração (Local TinyLlama)...');
        const generatorPath = path.join(modelsPath, 'TinyLlama-1.1B-Chat-v1.0'); // Mudança: Nome da pasta real
        generator = await pipeline('text-generation', generatorPath);
        console.log('Modelo de geração carregado.');
        console.log('Cérebro RAG inicializado e pronto para uso!');
        calculateAndCachePCA();
    } catch (error) {
        console.error('Falha ao inicializar o Cérebro RAG:', error);
    }
}
export function getCachedPlotData() {
  return cachedPlotData;
}
async function getEmbeddings(text) {
    if (!embedder) {
        console.log('Embedder não foi inicializado.');
        return null;
    }
    // Gera o vetor para o texto
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    // Retorna o vetor como um Array normal
    return Array.from(output.data);
}

export async function ingestPDF(filePath) {
    console.log(`Iniciando ingestão do arquivo: ${filePath}`);
    try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfParser = new PDFParse({ data: dataBuffer });
        const pdfResult = await pdfParser.getText();
        const text = pdfResult.text;
        console.log(`PDF lido, ${text.length} caracteres.`);

        // 2. Quebrar o texto em pedaços ("chunks")
        // Isso garante que cada pedaço de texto caiba no contexto do modelo
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 300, // 500 caracteres por pedaço
            chunkOverlap: 75,  // 50 caracteres de sobreposição
        });
        const chunks = await splitter.splitText(text);
        console.log(`Texto dividido em ${chunks.length} pedaços.`);

        // 3. Abrir nossa tabela no DB
        const table = await db.openTable('documentos');
        // 4. Criar embeddings para cada pedaço e salvar no DB
        console.log('Gerando embeddings e salvando no banco de dados...');
        for (const chunk of chunks) {
            const vector = await getEmbeddings(chunk);
            if (vector) {
                await table.add([{
                    vector: vector,
                    text: chunk
                }]);
            }
        }
        console.log('Ingestão concluída com sucesso!');
        return { success: true, message: `PDF ingerido com ${chunks.length} pedaços.` };

    } catch (error) {
        console.error('Falha na ingestão:', error);
        return { success: false, message: 'Falha ao ingerir o PDF.' };
    }

}

export async function askRAG(question) {
    if (!db || !embedder || !generator) {
        return "O Cérebro RAG não foi inicializado corretamente.";
    }
    console.log(`Recebida pergunta: ${question}`);

    try {
        // 1. Criar embedding para a PERGUNTA
        const queryVector = await getEmbeddings(question);
        // 2. Buscar no LanceDB pelos "pedaços" similares
        const table = await db.openTable('documentos');
        const results = await table.search(queryVector)
                                 .limit(3)
                                 .toArray();
        console.log(results)
        const resultsArray = results;
        // 4. MUDAR 'results.length' para 'resultsArray.length'
        if (resultsArray.length === 0) {
            return "Desculpe, não encontrei nenhuma informação relevante sobre isso nos meus documentos.";
        }
        // 5. Montar o Contexto (usar 'resultsArray.map')
        const context = resultsArray.map(r => r.text).join('\n---\n');
        console.log(`Contexto encontrado: ${context.substring(0, 100)}...`);
        // 4. Montar o Prompt "Enjaulado"
        const singlePrompt = `
        Contexto do documento:  ${context} --- Pergunta: ${question}
        `;

        // 5. Gerar a Resposta
        const messages = [
            { role: "system", content: "Você é um assistente útil que reposnde perguntas sobre documentos." },
            { role: "user", content: singlePrompt },
        ];

        // 5. Gerar a Resposta
        const formattedPrompt = generator.tokenizer.apply_chat_template(messages, {
            tokenize: false,
            add_generation_prompt: true,
        });

        const output = await generator(formattedPrompt, {
            max_new_tokens: 300, // Limita o tamanho da resposta
            temperature: 0.1,    // Deixa a resposta menos "criativa"
        });

        // Limpa a resposta para pegar só o que o assistente disse
        const answer = output[0].generated_text.split('<|assistant|>').pop().trim();
        console.log(`Resposta gerada: ${answer}`);

        return answer;

    } catch (error) {
        console.error('Falha ao gerar resposta:', error);
        return 'Ocorreu um erro ao processar sua pergunta.';
    }
}