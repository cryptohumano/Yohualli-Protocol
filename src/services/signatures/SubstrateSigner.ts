/**
 * Servicio para firmar documentos con llaves Substrate (Ed25519/sr25519)
 */

import { v4 as uuidv4 } from 'uuid'
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex } from '@polkadot/util'
import { PDFDocument } from 'pdf-lib'
import type { Document, DocumentSignature } from '@/types/documents'
import { calculatePDFHash } from '@/services/pdf/PDFHash'
import { updateDocument } from '@/utils/documentStorage'
import { getAutographicSignature } from '@/utils/autographicSignatureStorage'
import { addAutographicSignature } from './AutographicSigner'

export interface SignDocumentOptions {
  document: Document
  pair: KeyringPair
  reason?: string
  location?: string
}

/**
 * Firma un documento con una llave Substrate
 */
export async function signDocumentWithSubstrate(
  options: SignDocumentOptions
): Promise<Document> {
  const { document, pair, reason, location } = options

  if (!document.pdf) {
    throw new Error('El documento no tiene PDF para firmar')
  }

  // Calcular hash SHA-256 del PDF
  const pdfHash = await calculatePDFHash(document.pdf)

  // Firmar el hash con la llave privada
  const hashBytes = hexToUint8Array(pdfHash)
  const signature = pair.sign(hashBytes)
  const signatureHex = u8aToHex(signature)

  // Agregar metadatos X.509 al PDF con la cuenta Substrate
  let modifiedPdfBase64 = document.pdf
  let modifiedPdfSize = document.pdfSize
  
  try {
    // Convertir base64 a Uint8Array
    const base64Data = document.pdf.includes(',') ? document.pdf.split(',')[1] : document.pdf
    const pdfBytes = base64ToUint8Array(base64Data)
    
    // Cargar PDF con pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes)
    
    // Preservar metadatos existentes
    const existingTitle = pdfDoc.getTitle()
    const existingAuthor = pdfDoc.getAuthor()
    const existingSubject = pdfDoc.getSubject()
    const existingCreator = pdfDoc.getCreator()
    const existingProducer = pdfDoc.getProducer()
    const existingKeywords = pdfDoc.getKeywords()
    
    // Agregar información de la cuenta Substrate en los metadatos X.509
    // El campo Author debe contener la dirección Substrate
    const substrateAuthor = pair.address // Dirección Substrate como autor
    const substrateInfo = `Substrate Account: ${pair.address} (${pair.type})`
    const newSubject = existingSubject 
      ? `${existingSubject} | ${substrateInfo}`
      : substrateInfo
    
    // Agregar a keywords también
    const newKeywords = [
      ...(Array.isArray(existingKeywords) ? existingKeywords : []),
      `SubstrateAccount:${pair.address}`,
      `KeyType:${pair.type}`,
    ]
    
    // Establecer metadatos actualizados
    // El Author debe ser la dirección Substrate para X.509
    if (existingTitle) pdfDoc.setTitle(existingTitle)
    pdfDoc.setAuthor(substrateAuthor) // Autor = dirección Substrate
    pdfDoc.setSubject(newSubject)
    if (existingCreator) pdfDoc.setCreator(existingCreator)
    if (existingProducer) pdfDoc.setProducer(existingProducer)
    pdfDoc.setKeywords(newKeywords)
    
    // Guardar PDF modificado
    const modifiedPdfBytes = await pdfDoc.save()
    modifiedPdfBase64 = uint8ArrayToBase64(modifiedPdfBytes)
    modifiedPdfSize = modifiedPdfBytes.length
    
    console.log('[Substrate Signer] Metadatos X.509 agregados al PDF:', {
      subject: newSubject,
      keywords: newKeywords,
    })
  } catch (error) {
    console.error('[Substrate Signer] Error al agregar metadatos X.509:', error)
    // Continuar sin modificar el PDF si hay error
  }

  // Buscar y agregar firma autográfica automáticamente si existe
  try {
    const autographicSignature = await getAutographicSignature(pair.address)
    if (autographicSignature && autographicSignature.signatureImage) {
      console.log('[Substrate Signer] Firma autográfica encontrada, agregando automáticamente...')
      
      // Crear documento temporal con el PDF modificado para agregar la firma autográfica
      const tempDocument: Document = {
        ...document,
        pdf: modifiedPdfBase64,
        pdfSize: modifiedPdfSize,
      }

      // Agregar firma autográfica en todas las páginas, esquina inferior derecha
      const documentWithAutographic = await addAutographicSignature({
        document: tempDocument,
        signatureImage: autographicSignature.signatureImage,
        position: {
          page: -1, // -1 significa todas las páginas
          x: -1, // -1 significa desde la derecha (esquina inferior derecha)
          y: 20, // mm desde abajo
          width: 60,
          height: 30,
        },
        captureGPS: false,
      })

      // Actualizar PDF con la firma autográfica incluida
      modifiedPdfBase64 = documentWithAutographic.pdf
      modifiedPdfSize = documentWithAutographic.pdfSize
      
      console.log('[Substrate Signer] ✅ Firma autográfica agregada automáticamente')
    } else {
      console.log('[Substrate Signer] No se encontró firma autográfica para esta cuenta')
    }
  } catch (error) {
    console.warn('[Substrate Signer] Error al agregar firma autográfica automáticamente:', error)
    // Continuar sin la firma autográfica si hay error
  }

  // Crear objeto de firma con información X.509
  const documentSignature: DocumentSignature = {
    id: uuidv4(),
    type: 'substrate',
    signer: pair.address,
    signature: signatureHex,
    keyType: pair.type,
    timestamp: Date.now(),
    hash: pdfHash,
    metadata: {
      reason,
      location,
    },
    // Agregar información X.509 simulada (para compatibilidad)
    x509: {
      certificate: '', // No hay certificado real, pero agregamos la info
      signature: signatureHex,
      certificateInfo: {
        subject: `CN=Substrate Account, O=${pair.address}, OU=${pair.type}`,
        issuer: 'Yohualli Protocol',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 año
      },
    },
  }

  // Agregar firma al documento
  const updatedSignatures = [...(document.signatures || []), documentSignature]

  // Actualizar estado de firma
  let signatureStatus = document.signatureStatus
  if (document.requiredSigners && document.requiredSigners.length > 0) {
    const signedAddresses = updatedSignatures
      .filter(sig => sig.signer)
      .map(sig => sig.signer!)
    const allRequiredSigned = document.requiredSigners.every(addr =>
      signedAddresses.includes(addr)
    )
    const someRequiredSigned = document.requiredSigners.some(addr =>
      signedAddresses.includes(addr)
    )

    if (allRequiredSigned) {
      signatureStatus = 'fully_signed'
    } else if (someRequiredSigned) {
      signatureStatus = 'partially_signed'
    } else {
      signatureStatus = 'pending'
    }
  } else {
    signatureStatus = 'fully_signed'
  }

  // Actualizar documento con PDF modificado
  const updatedDocument: Document = {
    ...document,
    pdf: modifiedPdfBase64,
    pdfSize: modifiedPdfSize,
    signatures: updatedSignatures,
    signatureStatus,
    pendingSigners: document.requiredSigners
      ? document.requiredSigners.filter(
          addr => !updatedSignatures.some(sig => sig.signer === addr)
        )
      : undefined,
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await updateDocument(document.documentId, updatedDocument)

  return updatedDocument
}

/**
 * Convierte base64 a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Convierte Uint8Array a base64
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * Verifica una firma Substrate
 */
export async function verifySubstrateSignature(
  document: Document,
  signature: DocumentSignature
): Promise<boolean> {
  if (signature.type !== 'substrate' || !signature.signer || !signature.signature) {
    return false
  }

  try {
    // Recalcular hash del PDF
    if (!document.pdf) {
      return false
    }

    const currentHash = await calculatePDFHash(document.pdf)

    // Verificar que el hash coincida
    if (currentHash.toLowerCase() !== signature.hash.toLowerCase()) {
      console.warn('[Substrate Signer] Hash del documento no coincide')
      return false
    }

    // Nota: Para verificar completamente, necesitaríamos la public key
    // Por ahora, verificamos que el hash coincida
    // En una implementación completa, usaríamos @polkadot/util-crypto para verificar la firma

    return true
  } catch (error) {
    console.error('[Substrate Signer] Error al verificar firma:', error)
    return false
  }
}

/**
 * Convierte hex string a Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  // Remover prefijo 0x si existe
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex

  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16)
  }
  return bytes
}

