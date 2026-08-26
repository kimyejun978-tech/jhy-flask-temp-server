export type EventStatus = 'NONE' | 'INTERESTED' | 'PLANNING' | 'APPLIED' | 'COMPLETED';
export type EventDatePrecision = 'EXACT' | 'MONTH' | 'APPROXIMATE_RANGE' | 'TBD';

export type EventItem = {
  id: string;
  title: string;
  categories: string[];
  startDate: string | null;
  endDate: string | null;
  dateText?: string | null;
  datePrecision?: EventDatePrecision | null;
  deadline: string | null;
  location: string | null;
  isOnline: boolean | null;
  fee: number | null;
  highSchoolAllowed: boolean | null;
  importance: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string | null;
  sourceUrl: string;
  userStatus: EventStatus;
};

export type TrendItem = {
  id: string;
  title: string;
  author: string | null;
  url: string;
  tags: string[];
  categories?: string[];
  summary: string | null;
  whyRead: string | null;
  tryNext: string | null;
  importance: 'LOW' | 'MEDIUM' | 'HIGH';
  publishedAt: string | null;
};

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  channel: string;
  summary: string | null;
  highlights: string[];
  publishedAt: string | null;
};
