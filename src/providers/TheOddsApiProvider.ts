/**
 * The Odds API provider implementation
 * Documentation: https://the-odds-api.com/liveapi/guides/v4/
 */

import { OddsEvent, EventOdds } from '../config/types';

export interface TheOddsApiConfig {
  /** API key for The Odds API */
  apiKey: string;
  /** Base URL for the API (defaults to production) */
  baseUrl?: string;
  /** Rate limit in requests per second */
  rateLimit?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export class TheOddsApiProvider {
  private apiKey: string;
  private baseUrl: string;
  private rateLimit?: number;
  private timeout: number;

  constructor(config: TheOddsApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.the-odds-api.com/v4';
    this.rateLimit = config.rateLimit;
    this.timeout = config.timeout || 30000;
  }

  async fetchEvents(
    leagueKey: string,
    commenceTimeFrom?: string,
    commenceTimeTo?: string
  ): Promise<OddsEvent[]> {
    let url = `${this.baseUrl}/sports/${leagueKey}/events?dateFormat=iso&apiKey=${this.apiKey}`;

    if (commenceTimeFrom) {
      url += `&commenceTimeFrom=${commenceTimeFrom}`;
    }
    if (commenceTimeTo) {
      url += `&commenceTimeTo=${commenceTimeTo}`;
    }

    const response = await this.makeRequest(url);
    return this.mapEventsResponse(response);
  }

  async fetchEventOdds(
    leagueKey: string,
    eventId: string,
    markets: string,
    regions: string = 'eu'
  ): Promise<EventOdds> {
    const url = `${this.baseUrl}/sports/${leagueKey}/events/${eventId}/odds?regions=${regions}&markets=${markets}&dateFormat=iso&apiKey=${this.apiKey}`;

    const response = await this.makeRequest(url);
    return this.mapOddsResponse(response);
  }

  async fetchHistoricalEvents(
    leagueKey: string,
    snapshotDate: string,
    commenceTimeFrom?: string,
    commenceTimeTo?: string
  ): Promise<OddsEvent[]> {
    let url = `${this.baseUrl}/historical/sports/${leagueKey}/events?dateFormat=iso&date=${snapshotDate}&apiKey=${this.apiKey}`;

    if (commenceTimeFrom) {
      url += `&commenceTimeFrom=${commenceTimeFrom}`;
    }
    if (commenceTimeTo) {
      url += `&commenceTimeTo=${commenceTimeTo}`;
    }

    const response = await this.makeRequest(url);
    return this.mapEventsResponse(response.data || response);
  }

  async fetchHistoricalEventOdds(
    leagueKey: string,
    eventId: string,
    snapshotDate: string,
    markets: string,
    regions: string = 'eu'
  ): Promise<EventOdds> {
    const url = `${this.baseUrl}/historical/sports/${leagueKey}/events/${eventId}/odds?regions=${regions}&markets=${markets}&dateFormat=iso&date=${snapshotDate}&apiKey=${this.apiKey}`;

    const response = await this.makeRequest(url);
    return this.mapOddsResponse(response.data || response);
  }

  estimateCost(
    type: 'events' | 'live_odds' | 'historical_events' | 'historical_odds',
    markets: number,
    regions: number
  ): number {
    switch (type) {
      case 'events':
        return 0; // FREE
      case 'live_odds':
        return markets * regions;
      case 'historical_events':
        return 1;
      case 'historical_odds':
        return 10 * markets * regions;
      default:
        return 0;
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `HTTP error! Status: ${response.status} - ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Map The Odds API events response to standard format
   */
  private mapEventsResponse(response: any[]): OddsEvent[] {
    return response.map((event) => ({
      id: event.id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
      sportKey: event.sport_key,
    }));
  }

  /**
   * Map The Odds API odds response to standard format
   */
  private mapOddsResponse(response: any): EventOdds {
    return {
      id: response.id,
      sportKey: response.sport_key,
      homeTeam: response.home_team,
      awayTeam: response.away_team,
      commenceTime: response.commence_time,
      bookmakers: response.bookmakers.map((bookmaker: any) => ({
        key: bookmaker.key,
        title: bookmaker.title,
        lastUpdate: bookmaker.last_update,
        markets: bookmaker.markets.map((market: any) => ({
          key: market.key,
          outcomes: market.outcomes.map((outcome: any) => ({
            name: outcome.name,
            price: outcome.price,
            point: outcome.point,
          })),
        })),
      })),
    };
  }
}
