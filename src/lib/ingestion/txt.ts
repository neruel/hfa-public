// TXT parser – extracts text with UTF-8 decoding and EUC-KR fallback for Korean documents.

export async function parseTxt(data: ArrayBuffer): Promise<string> {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(data);
  } catch {
    const eucKrDecoder = new TextDecoder('euc-kr');
    return eucKrDecoder.decode(data);
  }
}

