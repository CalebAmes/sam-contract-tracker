class SamApiKeyManager {
  private keys: string[] | null = null;
  private currentIndex: number = 0;

  private initializeKeys() {
    if (this.keys === null) {
      this.keys = [
        process.env.SAM_API_KEY_3,
        process.env.SAM_API_KEY_1,
        process.env.SAM_API_KEY_2,
      ].filter(Boolean) as string[];

      console.log("Environment variables check:");
      console.log("SAM_API_KEY_1:", process.env.SAM_API_KEY_1 ? "SET" : "NOT SET");
      console.log("SAM_API_KEY_2:", process.env.SAM_API_KEY_2 ? "SET" : "NOT SET");
      console.log("SAM_API_KEY_3:", process.env.SAM_API_KEY_3 ? "SET" : "NOT SET");

      if (this.keys.length === 0) {
        throw new Error("No SAM API keys configured");
      }

      console.log(`SAM API Key Manager initialized with ${this.keys.length} keys, starting with key 3`);
    }
  }

  getCurrentKey(): string {
    this.initializeKeys();
    return this.keys![this.currentIndex];
  }

  rotateKey(): void {
    this.initializeKeys();
    const previousIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.keys!.length;
    console.log(`SAM API Key rotated from key ${previousIndex + 1} to key ${this.currentIndex + 1}`);
  }

  hasMoreKeys(): boolean {
    this.initializeKeys();
    return this.keys!.length > 1;
  }

  getCurrentKeyIndex(): number {
    this.initializeKeys();
    return this.currentIndex;
  }
}

// Export singleton instance
export const samApiKeyManager = new SamApiKeyManager();