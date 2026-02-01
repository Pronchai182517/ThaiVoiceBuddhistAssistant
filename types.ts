
export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  fileMetadata?: {
    name: string;
    type: string;
    content?: string; // Base64 for images preview
    isUrl?: boolean;
  };
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
