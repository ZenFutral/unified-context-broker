export class LocalEmbedder {
  private dimension: number;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * Generates a deterministic normalized pseudo-embedding vector for text
   * (Used in local test / zero-network mode; production hooks into ONNX runtime).
   */
  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimension).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const idx = (charCode * 31 + j * 17 + i * 7) % this.dimension;
        vector[idx] = (vector[idx] ?? 0) + 1.0;
      }
    }

    // L2 normalize
    let norm = 0;
    for (const v of vector) {
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i]! / norm;
      }
    }

    return vector;
  }

  /**
   * Computes cosine similarity between two unit vectors.
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += (vecA[i] ?? 0) * (vecB[i] ?? 0);
    }
    return Math.max(0.0, Math.min(1.0, (dotProduct + 1.0) / 2.0)); // scale to [0, 1]
  }
}
