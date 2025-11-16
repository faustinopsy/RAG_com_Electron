import { pipeline, env } from '@xenova/transformers';
import { connect } from '@lancedb/lancedb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';
import path from 'node:path'; 
import { app } from 'electron';

// --- CORREÇÃO 2: A importação correta do PDF-Parse (CJS) ---
// 1. Importar a ferramenta 'createRequire'
import { createRequire } from 'node:module';
// 2. Criar uma função 'require' local
const require = createRequire(import.meta.url);
// 3. Usar o 'require' para carregar a classe
const PDFParse = require('pdf-parse');
// ---------------------------------------------------------

// (PCA foi movido para o seu próprio ficheiro, por isso o import dele está correto)
import { calculateAndCachePCA, getCachedPlotData } from './pcaService.js';


console.log('--- O CAMINHO DO CACHE É ESTE: ---');
console.log(env.cacheDir);
console.log('---------------------------------');
env.allowLocalModels = true;
env.useBrowserCache = false;

let db;
let embedder;
let generator;

// Exporta a função da cache para o index.js
export { getCachedPlotData };


export async function initializeRAG() {
  try {
    console.log('Fase 1: Iniciando o Cérebro RAG...');
    const dbPath = './data/lancedb';
    db = await connect(dbPath);
    console.log(`Conectado ao LanceDB em: ${dbPath}`);
    
    const sampleData = [{
        vector: Array(384).fill(0),
        text: "amostra"
    }];
    
    try {
      await db.createTable('documentos', sampleData);
      console.log('Tabela "documentos" criada com sucesso.');
    } catch (e) {
      console.log('Tabela "documentos" já existe. Abrindo...');
      await db.openTable('documentos');
    }

    console.log('Carregando modelo de embedding (Xenova/all-MiniLM-L6-v2)...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Modelo de embedding carregado.');
    
    console.log('Carregando modelo de geração (TinyLlama-1.1B)...');
    generator = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0');
    console.log('Modelo de geração carregado.');

    console.log('✅ Cérebro RAG inicializado e pronto para uso!');
    
    // Inicia o cálculo do PCA em background
    calculateAndCachePCA(db);

  } catch (error) {
    console.error('Falha ao inicializar o Cérebro RAG:', error);
  }
}

async function getEmbeddings(text) {
  if (!embedder) {
    console.log('Embedder não foi inicializado.');
    return null;
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export async function ingestPDF(filePath) {
  console.log(`Iniciando ingestão do arquivo: ${filePath}`);
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // (A sua lógica de 'new PDFParse' agora funciona por causa da CORREÇÃO 2)
    const pdfParser = new PDFParse({ data: dataBuffer });
    const pdfResult = await pdfParser.getText();
    const text = pdfResult.text;
    console.log(`PDF lido, ${text.length} caracteres.`);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,
      chunkOverlap: 75,
    });
    const chunks = await splitter.splitText(text);
    console.log(`Texto dividido em ${chunks.length} pedaços.`);

    const table = await db.openTable('documentos');
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
    
    // Recalcula o PCA em background
    console.log('[PCA] Novo PDF ingerido, a recalcular os dados 3D em background...');
    calculateAndCachePCA(db); 

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
    const queryVector = await getEmbeddings(question);
    const table = await db.openTable('documentos');
    const results = await table.search(queryVector)
                             .limit(3)
                             .toArray();
    
    const resultsArray = results;
    
    if (resultsArray.length === 0) {
      return "Desculpe, eu não tenho essa informação nos meus documentos.";
    }
    
    const context = resultsArray.map(r => r.text).join('\n---\n');
    console.log(`Contexto encontrado: ${context.substring(0, 100)}...`);

    // --- CORREÇÃO 3: O Prompt Simples (Anti-Alucinação) ---
    // Este formato de "Preenchimento de Lacunas" funciona
    // muito melhor com modelos pequenos.
    const finalPrompt = `
Contexto:
${context}
---
Pergunta:
${question}
---
Resposta:
`;
    // --- FIM DA CORREÇÃO 3 ---

    // 5. Gerar a Resposta
    // Não precisamos de 'messages' ou 'apply_chat_template'
    // para este prompt simples.
    const output = await generator(finalPrompt, {
      max_new_tokens: 300,
      temperature: 0.1,
    });

    // Limpa a resposta (removendo o prompt que demos)
    const rawAnswer = output[0].generated_text;
    const answer = rawAnswer.substring(finalPrompt.length).trim();
    
    console.log(`Resposta gerada: ${answer}`);
    return answer;

  } catch (error) {
    console.error('Falha ao gerar resposta:', error);
    return 'Ocorreu um erro ao processar sua pergunta.';
  }
}