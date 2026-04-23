/**
 * Servicio principal para gestión de documentos
 */

import { v4 as uuidv4 } from 'uuid'
import type { Document, DocumentType, DocumentMetadata, GPSMetadata } from '@/types/documents'
import { saveDocument, getDocument } from '@/utils/documentStorage'
import { generatePDF, generateSimplePDF, generateContractPDF } from '@/services/pdf/PDFGenerator'
import type { PDFGenerationOptions } from '@/services/pdf/PDFGenerator'

export interface CreateDocumentOptions {
  type: DocumentType
  category?: string
  subcategory?: string
  metadata: DocumentMetadata
  gpsMetadata?: GPSMetadata
  pdfContent?: PDFGenerationOptions['content']
  relatedAccount?: string
  encrypted?: boolean
}

/**
 * Crea un nuevo documento
 */
export async function createDocument(options: CreateDocumentOptions): Promise<Document> {
  const documentId = uuidv4()
  
  // Generar PDF si se proporciona contenido
  let pdfBase64: string | undefined
  let pdfHash: string
  let pdfSize: number

  if (options.pdfContent) {
    const pdfResult = await generatePDF({
      metadata: options.metadata,
      gpsMetadata: options.gpsMetadata,
      content: options.pdfContent,
    })
    pdfBase64 = pdfResult.pdfBase64
    pdfHash = pdfResult.pdfHash
    pdfSize = pdfResult.pdfSize
  } else {
    // Crear PDF básico con solo metadata
    const pdfResult = await generateSimplePDF(
      options.metadata.title || 'Documento sin título',
      options.metadata.description || '',
      options.metadata
    )
    pdfBase64 = pdfResult.pdfBase64
    pdfHash = pdfResult.pdfHash
    pdfSize = pdfResult.pdfSize
  }

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: options.type,
    category: options.category,
    subcategory: options.subcategory,
    pdf: pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: options.encrypted || false,
    metadata: {
      ...options.metadata,
      createdAt: new Date().toISOString(),
      creator: 'Yohualli Protocol',
      producer: 'Yohualli Protocol PDF Generator',
    },
    gpsMetadata: options.gpsMetadata,
    relatedAccount: options.relatedAccount,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await saveDocument(document)

  return document
}

/**
 * Crea un documento de contrato
 */
export async function createContractDocument(
  contractTitle: string,
  parties: Array<{ name: string; address: string; role: string }>,
  terms: string[],
  options: {
    metadata?: Partial<DocumentMetadata>
    relatedAccount?: string
    requiredSigners?: string[]
  } = {}
): Promise<Document> {
  const documentId = uuidv4()

  // Generar PDF del contrato
  const pdfResult = await generateContractPDF(
    contractTitle,
    parties,
    terms,
    options.metadata
  )

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: 'contract',
    category: 'legal',
    pdf: pdfResult.pdfBase64,
    pdfHash: pdfResult.pdfHash,
    pdfSize: pdfResult.pdfSize,
    signatures: [],
    encrypted: false,
    metadata: {
      title: contractTitle,
      author: options.metadata?.author || '',
      subject: 'Contrato',
      keywords: ['contrato', 'legal'],
      language: 'es',
      creator: 'Yohualli Protocol',
      producer: 'Yohualli Protocol PDF Generator',
      createdAt: new Date().toISOString(),
    },
    relatedAccount: options.relatedAccount,
    signatureStatus: options.requiredSigners && options.requiredSigners.length > 0
      ? 'pending'
      : undefined,
    requiredSigners: options.requiredSigners,
    pendingSigners: options.requiredSigners,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await saveDocument(document)

  return document
}

/**
 * Crea un documento desde un PDF base64 ya generado
 */
export async function createDocumentFromPDF(
  options: {
    type: DocumentType
    category?: string
    subcategory?: string
    metadata: DocumentMetadata
    gpsMetadata?: GPSMetadata
    pdfBase64: string
    relatedAccount?: string
    encrypted?: boolean
  }
): Promise<Document> {
  const documentId = uuidv4()
  
  // Calcular hash y tamaño del PDF
  const { calculatePDFHash } = await import('@/services/pdf/PDFHash')
  const pdfHash = await calculatePDFHash(options.pdfBase64)
  
  // Calcular tamaño (aproximado desde base64)
  const pdfSize = Math.floor((options.pdfBase64.length * 3) / 4)

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: options.type,
    category: options.category,
    subcategory: options.subcategory,
    pdf: options.pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: options.encrypted || false,
    metadata: {
      ...options.metadata,
      createdAt: new Date().toISOString(),
      creator: 'Yohualli Protocol',
      producer: 'Yohualli Protocol PDF Generator',
    },
    gpsMetadata: options.gpsMetadata,
    relatedAccount: options.relatedAccount,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await saveDocument(document)

  return document
}

/**
 * Obtiene un documento por ID
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  return await getDocument(documentId)
}

