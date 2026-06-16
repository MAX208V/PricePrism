export interface App {
  id: string;
  appId: string;
  name: string;
  price: number;
  threshold: number;
  country: string;
  note?: string;
  monitorMode: 'threshold' | 'change';
  icon?: string;
  createdAt: number;
  updatedAt: number;
  lastNotifiedAt?: number;
}

export interface AppHistory {
  price: number;
  time: number;
}

export interface PlayAppDetails {
  appId: string;
  title: string;
  developer: string;
  price: number;
  free: boolean;
  score: number;
  ratings: string;
  icon: string;
  screenshots: string[];
}

export interface SearchResults {
  results: PlayAppDetails[];
}

export interface NotificationMessage {
  appId: string;
  appName: string;
  oldPrice?: number;
  newPrice: number;
  threshold: number;
}

export interface Settings {
  pushEnabled: boolean;
  pushKey: string;
  pushUID: string;
  playProxy?: string;
}