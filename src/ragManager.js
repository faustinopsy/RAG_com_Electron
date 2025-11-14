import { pipeline, env } from '@xenova/transformers';
import { connect } from '@lancedb/lancedb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';   
import path from 'path';
import { PDFParse } from 'pdf-parse';


env.allowLocalModels = true;
env.useBrowserCache = false;

let db;
let embedder;


export async function initializeRAG() {
    try {
        console.log('Fase 1: Iniciando o Cérebro RAG...');

        // 1. Conectar ao Banco Vetorial
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
        console.log('Carregando modelo de embedding (Xenova/all-MiniLM-L6-v2)...');
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Modelo de embedding carregado.');

        console.log(' Cérebro RAG inicializado e pronto para uso!');

    } catch (error) {
        console.error('Falha ao inicializar o Cérebro RAG:', error);
    }
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
            chunkSize: 500, // 500 caracteres por pedaço
            chunkOverlap: 50,  // 50 caracteres de sobreposição
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