export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      Organization: {
        Row: {
          id: string;
        };
        Insert: {
          id?: string;
        };
        Update: {
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      UserProfile: {
        Row: {
          id: string | null;
          name: string | null;
          email: string | null;
          profilePicture: string | null;
          rollNumber: string | null;
          department: string | null;
          role: string | null;
          dailyStreak: number | null;
          totalXP: number | null;
          orgId: string | null;
          createdAt: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
      bug_report_status: 'OPEN' | 'FIXED';
      plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
      plan_status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
    };
    CompositeTypes: Record<string, never>;
  };
};
