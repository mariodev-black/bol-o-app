import type { ArtilheiroPickSlot } from "@/lib/artilheiros/config";

export type ArtilheiroTeamSummary = {
  apiTeamId: number;
  nome: string;
  /** Nome amigável em PT-BR (ex.: Brasil). */
  displayNome: string;
  codigo: string;
  pais: string;
  logo: string;
  grupo: string | null;
  /** Grupo formatado (ex.: Grupo C). */
  grupoLabel: string | null;
  totalJogadores: number;
  rank: number | null;
  descricao: string | null;
};

export type ArtilheiroPlayerSummary = {
  apiPlayerId: number;
  apiTeamId: number;
  nome: string;
  idade: number | null;
  numero: number | null;
  posicao: string;
  /** Posição em PT-BR (ex.: Atacante). */
  posicaoLabel: string;
  foto: string;
  teamNome: string;
  teamDisplayNome: string;
  teamLogo: string;
  teamCodigo: string;
};

export type ArtilheiroPickRow = {
  slot: ArtilheiroPickSlot;
  apiPlayerId: number;
  apiTeamId: number;
  playerName: string;
  teamName: string;
  teamLogo: string | null;
  playerPhoto: string | null;
  playerPosition: string | null;
  playerNumber: number | null;
  playerAge: number | null;
  lockedAt: string;
};

export type ArtilheiroOfficialResultRow = {
  slot: ArtilheiroPickSlot;
  apiPlayerId: number;
  apiTeamId: number;
  playerName: string;
  teamName: string;
  teamLogo: string | null;
  playerPhoto: string | null;
  goals: number;
  appliedAt: string | null;
};

export type ArtilheiroTicketScoreRow = {
  ticketId: string;
  userId: string;
  positionPoints: number;
  bonusPoints: number;
  totalPoints: number;
  updatedAt: string;
};
