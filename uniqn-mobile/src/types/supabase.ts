export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      action_logs: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          ip_address: string | null;
          metadata: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          author_id: string | null;
          author_name: string;
          category: Database['public']['Enums']['announcement_category'];
          content: string;
          created_at: string | null;
          id: string;
          image_storage_path: string | null;
          image_url: string | null;
          image_url_blurhash: string | null;
          images: Json | null;
          is_pinned: boolean | null;
          priority: number | null;
          published_at: string | null;
          status: Database['public']['Enums']['announcement_status'];
          target_audience: Json | null;
          title: string;
          updated_at: string | null;
          view_count: number | null;
        };
        Insert: {
          author_id?: string | null;
          author_name: string;
          category?: Database['public']['Enums']['announcement_category'];
          content: string;
          created_at?: string | null;
          id?: string;
          image_storage_path?: string | null;
          image_url?: string | null;
          image_url_blurhash?: string | null;
          images?: Json | null;
          is_pinned?: boolean | null;
          priority?: number | null;
          published_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'];
          target_audience?: Json | null;
          title: string;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Update: {
          author_id?: string | null;
          author_name?: string;
          category?: Database['public']['Enums']['announcement_category'];
          content?: string;
          created_at?: string | null;
          id?: string;
          image_storage_path?: string | null;
          image_url?: string | null;
          image_url_blurhash?: string | null;
          images?: Json | null;
          is_pinned?: boolean | null;
          priority?: number | null;
          published_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'];
          target_audience?: Json | null;
          title?: string;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      app_config: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          applicant_email: string | null;
          applicant_id: string;
          applicant_name: string;
          applicant_nickname: string | null;
          applicant_phone: string | null;
          applicant_photo_url: string | null;
          applicant_photo_url_blurhash: string | null;
          applicant_provision_consent_at: string | null;
          applicant_provision_consent_version: string | null;
          applicant_role: Database['public']['Enums']['staff_role'] | null;
          assignments: Json | null;
          cancellation_request: Json | null;
          cancelled_at: string | null;
          confirmation_history: Json | null;
          confirmed_at: string | null;
          created_at: string | null;
          custom_role: string | null;
          id: string;
          is_read: boolean | null;
          job_posting_date: string | null;
          job_posting_id: string;
          job_posting_title: string | null;
          message: string | null;
          notes: string | null;
          original_application: Json | null;
          pre_question_answers: Json | null;
          processed_at: string | null;
          processed_by: string | null;
          recruitment_type: string | null;
          rejection_reason: string | null;
          status: Database['public']['Enums']['application_status'];
          updated_at: string | null;
        };
        Insert: {
          applicant_email?: string | null;
          applicant_id: string;
          applicant_name: string;
          applicant_nickname?: string | null;
          applicant_phone?: string | null;
          applicant_photo_url?: string | null;
          applicant_photo_url_blurhash?: string | null;
          applicant_provision_consent_at?: string | null;
          applicant_provision_consent_version?: string | null;
          applicant_role?: Database['public']['Enums']['staff_role'] | null;
          assignments?: Json | null;
          cancellation_request?: Json | null;
          cancelled_at?: string | null;
          confirmation_history?: Json | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          custom_role?: string | null;
          id?: string;
          is_read?: boolean | null;
          job_posting_date?: string | null;
          job_posting_id: string;
          job_posting_title?: string | null;
          message?: string | null;
          notes?: string | null;
          original_application?: Json | null;
          pre_question_answers?: Json | null;
          processed_at?: string | null;
          processed_by?: string | null;
          recruitment_type?: string | null;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['application_status'];
          updated_at?: string | null;
        };
        Update: {
          applicant_email?: string | null;
          applicant_id?: string;
          applicant_name?: string;
          applicant_nickname?: string | null;
          applicant_phone?: string | null;
          applicant_photo_url?: string | null;
          applicant_photo_url_blurhash?: string | null;
          applicant_provision_consent_at?: string | null;
          applicant_provision_consent_version?: string | null;
          applicant_role?: Database['public']['Enums']['staff_role'] | null;
          assignments?: Json | null;
          cancellation_request?: Json | null;
          cancelled_at?: string | null;
          confirmation_history?: Json | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          custom_role?: string | null;
          id?: string;
          is_read?: boolean | null;
          job_posting_date?: string | null;
          job_posting_id?: string;
          job_posting_title?: string | null;
          message?: string | null;
          notes?: string | null;
          original_application?: Json | null;
          pre_question_answers?: Json | null;
          processed_at?: string | null;
          processed_by?: string | null;
          recruitment_type?: string | null;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['application_status'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_applicant_id_fkey';
            columns: ['applicant_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
        ];
      };
      board_comment_reactions: {
        Row: {
          comment_id: string;
          created_at: string;
          id: string;
          post_id: string;
          type: string;
          user_id: string;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          id?: string;
          post_id: string;
          type: string;
          user_id: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'board_comment_reactions_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'board_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comment_reactions_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comment_reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      board_comments: {
        Row: {
          author_id: string | null;
          author_name: string;
          author_role: string;
          body: string;
          created_at: string | null;
          id: string;
          image_attachments: Json | null;
          is_pinned: boolean | null;
          mentioned_user_ids: string[] | null;
          parent_comment_id: string | null;
          pinned_at: string | null;
          pinned_by: string | null;
          post_id: string;
          reaction_counts: Json | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          author_name: string;
          author_role: string;
          body: string;
          created_at?: string | null;
          id?: string;
          image_attachments?: Json | null;
          is_pinned?: boolean | null;
          mentioned_user_ids?: string[] | null;
          parent_comment_id?: string | null;
          pinned_at?: string | null;
          pinned_by?: string | null;
          post_id: string;
          reaction_counts?: Json | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          author_name?: string;
          author_role?: string;
          body?: string;
          created_at?: string | null;
          id?: string;
          image_attachments?: Json | null;
          is_pinned?: boolean | null;
          mentioned_user_ids?: string[] | null;
          parent_comment_id?: string | null;
          pinned_at?: string | null;
          pinned_by?: string | null;
          post_id?: string;
          reaction_counts?: Json | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'board_comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comments_parent_comment_id_fkey';
            columns: ['parent_comment_id'];
            isOneToOne: false;
            referencedRelation: 'board_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      board_memberships: {
        Row: {
          author_id: string | null;
          board_type: Database['public']['Enums']['board_type'] | null;
          can_comment: boolean | null;
          can_read: boolean | null;
          created_at: string | null;
          display_name: string | null;
          id: string;
          job_posting_id: string;
          last_activity_at: string | null;
          post_id: string;
          role: string | null;
          title: string | null;
          updated_at: string | null;
          user_id: string;
          work_date: string | null;
        };
        Insert: {
          author_id?: string | null;
          board_type?: Database['public']['Enums']['board_type'] | null;
          can_comment?: boolean | null;
          can_read?: boolean | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          job_posting_id: string;
          last_activity_at?: string | null;
          post_id: string;
          role?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id: string;
          work_date?: string | null;
        };
        Update: {
          author_id?: string | null;
          board_type?: Database['public']['Enums']['board_type'] | null;
          can_comment?: boolean | null;
          can_read?: boolean | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          job_posting_id?: string;
          last_activity_at?: string | null;
          post_id?: string;
          role?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string;
          work_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'board_memberships_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_memberships_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      board_posts: {
        Row: {
          announcement_category: Database['public']['Enums']['announcement_category'] | null;
          author_id: string | null;
          author_name: string;
          author_role: string;
          board_type: Database['public']['Enums']['board_type'];
          body: string;
          comment_count: number | null;
          created_at: string | null;
          dislike_count: number | null;
          id: string;
          image_attachments: Json | null;
          is_auto_created: boolean | null;
          is_locked: boolean | null;
          is_pinned: boolean | null;
          job_summary: Json | null;
          last_activity_at: string | null;
          like_count: number | null;
          linked_job_posting_id: string | null;
          locked_at: string | null;
          locked_by: string | null;
          source: string | null;
          status: string | null;
          title: string;
          updated_at: string | null;
          view_count: number | null;
          visibility: string | null;
        };
        Insert: {
          announcement_category?: Database['public']['Enums']['announcement_category'] | null;
          author_id?: string | null;
          author_name: string;
          author_role: string;
          board_type?: Database['public']['Enums']['board_type'];
          body: string;
          comment_count?: number | null;
          created_at?: string | null;
          dislike_count?: number | null;
          id?: string;
          image_attachments?: Json | null;
          is_auto_created?: boolean | null;
          is_locked?: boolean | null;
          is_pinned?: boolean | null;
          job_summary?: Json | null;
          last_activity_at?: string | null;
          like_count?: number | null;
          linked_job_posting_id?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          source?: string | null;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          view_count?: number | null;
          visibility?: string | null;
        };
        Update: {
          announcement_category?: Database['public']['Enums']['announcement_category'] | null;
          author_id?: string | null;
          author_name?: string;
          author_role?: string;
          board_type?: Database['public']['Enums']['board_type'];
          body?: string;
          comment_count?: number | null;
          created_at?: string | null;
          dislike_count?: number | null;
          id?: string;
          image_attachments?: Json | null;
          is_auto_created?: boolean | null;
          is_locked?: boolean | null;
          is_pinned?: boolean | null;
          job_summary?: Json | null;
          last_activity_at?: string | null;
          like_count?: number | null;
          linked_job_posting_id?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          source?: string | null;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          view_count?: number | null;
          visibility?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'board_posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_posts_linked_job_posting_id_fkey';
            columns: ['linked_job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
        ];
      };
      board_reports: {
        Row: {
          created_at: string | null;
          details: string | null;
          id: string;
          post_id: string;
          reason: string;
          reporter_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string | null;
          target_id: string;
          target_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          details?: string | null;
          id?: string;
          post_id: string;
          reason: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string | null;
          target_id: string;
          target_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          details?: string | null;
          id?: string;
          post_id?: string;
          reason?: string;
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string | null;
          target_id?: string;
          target_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'board_reports_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      board_votes: {
        Row: {
          created_at: string | null;
          id: string;
          post_id: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          post_id: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          post_id?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'board_votes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_votes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      diamond_products: {
        Row: {
          active: boolean;
          bonus_diamonds: number;
          created_at: string;
          diamonds: number;
          display_order: number;
          price_krw: number;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          bonus_diamonds?: number;
          created_at?: string;
          diamonds: number;
          display_order?: number;
          price_krw: number;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          bonus_diamonds?: number;
          created_at?: string;
          diamonds?: number;
          display_order?: number;
          price_krw?: number;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employer_applications: {
        Row: {
          agreements_snapshot: Json;
          created_at: string | null;
          id: string;
          intro: string | null;
          rejection_category: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          submitted_at: string;
          supersedes_id: string | null;
          user_id: string;
        };
        Insert: {
          agreements_snapshot: Json;
          created_at?: string | null;
          id?: string;
          intro?: string | null;
          rejection_category?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status: string;
          submitted_at?: string;
          supersedes_id?: string | null;
          user_id: string;
        };
        Update: {
          agreements_snapshot?: Json;
          created_at?: string | null;
          id?: string;
          intro?: string | null;
          rejection_category?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string;
          supersedes_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employer_applications_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employer_applications_supersedes_id_fkey';
            columns: ['supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'employer_applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employer_applications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      event_qr_codes: {
        Row: {
          assignment_group_id: string | null;
          code: string;
          created_at: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          job_posting_id: string;
          time_slot: string | null;
          type: string;
          user_id: string;
          work_date: string | null;
        };
        Insert: {
          assignment_group_id?: string | null;
          code: string;
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          job_posting_id: string;
          time_slot?: string | null;
          type: string;
          user_id: string;
          work_date?: string | null;
        };
        Update: {
          assignment_group_id?: string | null;
          code?: string;
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          job_posting_id?: string;
          time_slot?: string | null;
          type?: string;
          user_id?: string;
          work_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_qr_codes_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_qr_codes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      fcm_tokens: {
        Row: {
          last_refreshed_at: string;
          platform: string;
          registered_at: string;
          token: string;
          type: string;
          user_id: string;
        };
        Insert: {
          last_refreshed_at?: string;
          platform: string;
          registered_at?: string;
          token: string;
          type: string;
          user_id: string;
        };
        Update: {
          last_refreshed_at?: string;
          platform?: string;
          registered_at?: string;
          token?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fcm_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      heart_lots: {
        Row: {
          amount_initial: number;
          amount_remaining: number;
          expires_at: string;
          granted_at: string;
          id: string;
          source: Database['public']['Enums']['wallet_reason'];
          source_ref_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_initial: number;
          amount_remaining: number;
          expires_at: string;
          granted_at?: string;
          id?: string;
          source: Database['public']['Enums']['wallet_reason'];
          source_ref_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_initial?: number;
          amount_remaining?: number;
          expires_at?: string;
          granted_at?: string;
          id?: string;
          source?: Database['public']['Enums']['wallet_reason'];
          source_ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'heart_lots_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      inquiries: {
        Row: {
          attachments: Json | null;
          category: string | null;
          created_at: string | null;
          id: string;
          message: string;
          responded_at: string | null;
          responder_id: string | null;
          responder_name: string | null;
          response: string | null;
          status: Database['public']['Enums']['inquiry_status'] | null;
          subject: string;
          updated_at: string | null;
          user_email: string | null;
          user_id: string | null;
          user_name: string | null;
        };
        Insert: {
          attachments?: Json | null;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          message: string;
          responded_at?: string | null;
          responder_id?: string | null;
          responder_name?: string | null;
          response?: string | null;
          status?: Database['public']['Enums']['inquiry_status'] | null;
          subject: string;
          updated_at?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_name?: string | null;
        };
        Update: {
          attachments?: Json | null;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string;
          responded_at?: string | null;
          responder_id?: string | null;
          responder_name?: string | null;
          response?: string | null;
          status?: Database['public']['Enums']['inquiry_status'] | null;
          subject?: string;
          updated_at?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inquiries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      job_posting_collaborator_audit: {
        Row: {
          action: string;
          actor_user_id: string | null;
          at: string;
          id: string;
          job_posting_id: string;
          source: string;
          target_user_id: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          at?: string;
          id?: string;
          job_posting_id: string;
          source?: string;
          target_user_id: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          at?: string;
          id?: string;
          job_posting_id?: string;
          source?: string;
          target_user_id?: string;
        };
        Relationships: [];
      };
      job_posting_collaborators: {
        Row: {
          added_at: string;
          added_by: string;
          id: string;
          job_posting_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          id?: string;
          job_posting_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          id?: string;
          job_posting_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_posting_collaborators_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
        ];
      };
      job_posting_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          template_data: Json;
          updated_at: string | null;
          usage_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          template_data?: Json;
          updated_at?: string | null;
          usage_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          template_data?: Json;
          updated_at?: string | null;
          usage_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_posting_templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      job_postings: {
        Row: {
          closed_at: string | null;
          closed_reason: string | null;
          compensation: Json | null;
          contact_phone: string | null;
          created_at: string | null;
          description: string | null;
          filled_positions: number | null;
          fixed_config: Json | null;
          id: string;
          is_featured: boolean | null;
          last_work_date: string | null;
          location: Json;
          og_image_url: string | null;
          og_image_url_blurhash: string | null;
          owner_id: string | null;
          owner_name: string | null;
          posting_type: Database['public']['Enums']['posting_type'] | null;
          questions: Json | null;
          rejection_reason: string | null;
          role_catalog: Json | null;
          role_keys: string[] | null;
          schedule: Json;
          schema_version: number | null;
          stats: Json | null;
          status: Database['public']['Enums']['posting_status'];
          tags: string[] | null;
          title: string;
          total_positions: number | null;
          tournament_config: Json | null;
          updated_at: string | null;
          urgent_config: Json | null;
          view_count: number | null;
          work_date: string | null;
          work_dates: string[] | null;
          workspace_id: string;
        };
        Insert: {
          closed_at?: string | null;
          closed_reason?: string | null;
          compensation?: Json | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          filled_positions?: number | null;
          fixed_config?: Json | null;
          id?: string;
          is_featured?: boolean | null;
          last_work_date?: string | null;
          location?: Json;
          og_image_url?: string | null;
          og_image_url_blurhash?: string | null;
          owner_id?: string | null;
          owner_name?: string | null;
          posting_type?: Database['public']['Enums']['posting_type'] | null;
          questions?: Json | null;
          rejection_reason?: string | null;
          role_catalog?: Json | null;
          role_keys?: string[] | null;
          schedule?: Json;
          schema_version?: number | null;
          stats?: Json | null;
          status?: Database['public']['Enums']['posting_status'];
          tags?: string[] | null;
          title: string;
          total_positions?: number | null;
          tournament_config?: Json | null;
          updated_at?: string | null;
          urgent_config?: Json | null;
          view_count?: number | null;
          work_date?: string | null;
          work_dates?: string[] | null;
          workspace_id: string;
        };
        Update: {
          closed_at?: string | null;
          closed_reason?: string | null;
          compensation?: Json | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          filled_positions?: number | null;
          fixed_config?: Json | null;
          id?: string;
          is_featured?: boolean | null;
          last_work_date?: string | null;
          location?: Json;
          og_image_url?: string | null;
          og_image_url_blurhash?: string | null;
          owner_id?: string | null;
          owner_name?: string | null;
          posting_type?: Database['public']['Enums']['posting_type'] | null;
          questions?: Json | null;
          rejection_reason?: string | null;
          role_catalog?: Json | null;
          role_keys?: string[] | null;
          schedule?: Json;
          schema_version?: number | null;
          stats?: Json | null;
          status?: Database['public']['Enums']['posting_status'];
          tags?: string[] | null;
          title?: string;
          total_positions?: number | null;
          tournament_config?: Json | null;
          updated_at?: string | null;
          urgent_config?: Json | null;
          view_count?: number | null;
          work_date?: string | null;
          work_dates?: string[] | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_postings_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_postings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_counters: {
        Row: {
          unread_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          unread_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          unread_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          categories: Json | null;
          created_at: string | null;
          enabled: boolean;
          grouping: Json | null;
          id: string;
          push_enabled: boolean;
          quiet_hours: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          categories?: Json | null;
          created_at?: string | null;
          enabled?: boolean;
          grouping?: Json | null;
          id?: string;
          push_enabled?: boolean;
          quiet_hours?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          categories?: Json | null;
          created_at?: string | null;
          enabled?: boolean;
          grouping?: Json | null;
          id?: string;
          push_enabled?: boolean;
          quiet_hours?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          category: Database['public']['Enums']['notification_category'] | null;
          created_at: string | null;
          data: Json | null;
          id: string;
          is_read: boolean | null;
          link: string | null;
          priority: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          type: string;
        };
        Insert: {
          body: string;
          category?: Database['public']['Enums']['notification_category'] | null;
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          is_read?: boolean | null;
          link?: string | null;
          priority?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          type: string;
        };
        Update: {
          body?: string;
          category?: Database['public']['Enums']['notification_category'] | null;
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          is_read?: boolean | null;
          link?: string | null;
          priority?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      processed_identity_verifications: {
        Row: {
          function_name: string;
          processed_at: string;
          user_id: string;
          verification_id: string;
        };
        Insert: {
          function_name: string;
          processed_at?: string;
          user_id: string;
          verification_id: string;
        };
        Update: {
          function_name?: string;
          processed_at?: string;
          user_id?: string;
          verification_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          expires_at: string | null;
          id: string;
          key: string;
          last_refill: string | null;
          tokens: number | null;
        };
        Insert: {
          expires_at?: string | null;
          id?: string;
          key: string;
          last_refill?: string | null;
          tokens?: number | null;
        };
        Update: {
          expires_at?: string | null;
          id?: string;
          key?: string;
          last_refill?: string | null;
          tokens?: number | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string | null;
          description: string;
          evidence_urls: string[] | null;
          id: string;
          job_posting_id: string;
          job_posting_title: string | null;
          reporter_id: string | null;
          reporter_name: string;
          reporter_type: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          reviewer_notes: string | null;
          severity: Database['public']['Enums']['report_severity'] | null;
          status: string | null;
          target_id: string;
          target_name: string;
          type: string;
          updated_at: string | null;
          work_date: string | null;
          work_log_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          description: string;
          evidence_urls?: string[] | null;
          id?: string;
          job_posting_id: string;
          job_posting_title?: string | null;
          reporter_id?: string | null;
          reporter_name: string;
          reporter_type: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          severity?: Database['public']['Enums']['report_severity'] | null;
          status?: string | null;
          target_id: string;
          target_name: string;
          type: string;
          updated_at?: string | null;
          work_date?: string | null;
          work_log_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string;
          evidence_urls?: string[] | null;
          id?: string;
          job_posting_id?: string;
          job_posting_title?: string | null;
          reporter_id?: string | null;
          reporter_name?: string;
          reporter_type?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          severity?: Database['public']['Enums']['report_severity'] | null;
          status?: string | null;
          target_id?: string;
          target_name?: string;
          type?: string;
          updated_at?: string | null;
          work_date?: string | null;
          work_log_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_work_log_id_fkey';
            columns: ['work_log_id'];
            isOneToOne: false;
            referencedRelation: 'work_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          bubble_score_change: number | null;
          comment: string | null;
          created_at: string | null;
          id: string;
          job_posting_id: string;
          job_posting_title: string | null;
          reviewee_id: string | null;
          reviewee_name: string;
          reviewer_id: string | null;
          reviewer_name: string;
          reviewer_type: string;
          sentiment: Database['public']['Enums']['review_sentiment'];
          tags: string[] | null;
          work_date: string | null;
          work_log_id: string;
        };
        Insert: {
          bubble_score_change?: number | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          job_posting_id: string;
          job_posting_title?: string | null;
          reviewee_id?: string | null;
          reviewee_name: string;
          reviewer_id?: string | null;
          reviewer_name: string;
          reviewer_type: string;
          sentiment: Database['public']['Enums']['review_sentiment'];
          tags?: string[] | null;
          work_date?: string | null;
          work_log_id: string;
        };
        Update: {
          bubble_score_change?: number | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          job_posting_id?: string;
          job_posting_title?: string | null;
          reviewee_id?: string | null;
          reviewee_name?: string;
          reviewer_id?: string | null;
          reviewer_name?: string;
          reviewer_type?: string;
          sentiment?: Database['public']['Enums']['review_sentiment'];
          tags?: string[] | null;
          work_date?: string | null;
          work_log_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_reviewee_id_fkey';
            columns: ['reviewee_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_work_log_id_fkey';
            columns: ['work_log_id'];
            isOneToOne: false;
            referencedRelation: 'work_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      schedule_board_sync_outbox: {
        Row: {
          action: string;
          created_at: string;
          error_message: string | null;
          id: string;
          job_posting_id: string;
          payload: Json;
          retry_count: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          job_posting_id: string;
          payload?: Json;
          retry_count?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          job_posting_id?: string;
          payload?: Json;
          retry_count?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          agreed: boolean;
          agreed_at: string | null;
          consent_type: string;
          created_at: string | null;
          id: string;
          user_id: string;
          version: string | null;
        };
        Insert: {
          agreed?: boolean;
          agreed_at?: string | null;
          consent_type: string;
          created_at?: string | null;
          id?: string;
          user_id: string;
          version?: string | null;
        };
        Update: {
          agreed?: boolean;
          agreed_at?: string | null;
          consent_type?: string;
          created_at?: string | null;
          id?: string;
          user_id?: string;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          birth_date: string | null;
          bubble_score: Json | null;
          career: string | null;
          created_at: string | null;
          deletion_requested_at: string | null;
          deletion_scheduled_for: string | null;
          email: string;
          employer_agreements: Json | null;
          employer_registered_at: string | null;
          experience_years: number | null;
          fcm_tokens: Json | null;
          gender: string | null;
          id: string;
          identity_ci_hash: string | null;
          identity_data: Json | null;
          identity_provider: string | null;
          identity_verified: boolean | null;
          identity_verified_at: string | null;
          is_active: boolean | null;
          is_orphan: boolean | null;
          marketing_agreed: boolean | null;
          name: string;
          nickname: string | null;
          note: string | null;
          phone: string | null;
          phone_verified: boolean | null;
          photo_url: string | null;
          photo_url_blurhash: string | null;
          privacy_agreed: boolean | null;
          profile_completed: boolean | null;
          region: string | null;
          role: Database['public']['Enums']['user_role'];
          social_provider: string | null;
          status: string | null;
          terms_agreed: boolean | null;
          third_party_agreed: boolean | null;
          third_party_agreed_at: string | null;
          third_party_agreed_version: string | null;
          updated_at: string | null;
        };
        Insert: {
          birth_date?: string | null;
          bubble_score?: Json | null;
          career?: string | null;
          created_at?: string | null;
          deletion_requested_at?: string | null;
          deletion_scheduled_for?: string | null;
          email: string;
          employer_agreements?: Json | null;
          employer_registered_at?: string | null;
          experience_years?: number | null;
          fcm_tokens?: Json | null;
          gender?: string | null;
          id: string;
          identity_ci_hash?: string | null;
          identity_data?: Json | null;
          identity_provider?: string | null;
          identity_verified?: boolean | null;
          identity_verified_at?: string | null;
          is_active?: boolean | null;
          is_orphan?: boolean | null;
          marketing_agreed?: boolean | null;
          name: string;
          nickname?: string | null;
          note?: string | null;
          phone?: string | null;
          phone_verified?: boolean | null;
          photo_url?: string | null;
          photo_url_blurhash?: string | null;
          privacy_agreed?: boolean | null;
          profile_completed?: boolean | null;
          region?: string | null;
          role?: Database['public']['Enums']['user_role'];
          social_provider?: string | null;
          status?: string | null;
          terms_agreed?: boolean | null;
          third_party_agreed?: boolean | null;
          third_party_agreed_at?: string | null;
          third_party_agreed_version?: string | null;
          updated_at?: string | null;
        };
        Update: {
          birth_date?: string | null;
          bubble_score?: Json | null;
          career?: string | null;
          created_at?: string | null;
          deletion_requested_at?: string | null;
          deletion_scheduled_for?: string | null;
          email?: string;
          employer_agreements?: Json | null;
          employer_registered_at?: string | null;
          experience_years?: number | null;
          fcm_tokens?: Json | null;
          gender?: string | null;
          id?: string;
          identity_ci_hash?: string | null;
          identity_data?: Json | null;
          identity_provider?: string | null;
          identity_verified?: boolean | null;
          identity_verified_at?: string | null;
          is_active?: boolean | null;
          is_orphan?: boolean | null;
          marketing_agreed?: boolean | null;
          name?: string;
          nickname?: string | null;
          note?: string | null;
          phone?: string | null;
          phone_verified?: boolean | null;
          photo_url?: string | null;
          photo_url_blurhash?: string | null;
          privacy_agreed?: boolean | null;
          profile_completed?: boolean | null;
          region?: string | null;
          role?: Database['public']['Enums']['user_role'];
          social_provider?: string | null;
          status?: string | null;
          terms_agreed?: boolean | null;
          third_party_agreed?: boolean | null;
          third_party_agreed_at?: string | null;
          third_party_agreed_version?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      wallet_ledger: {
        Row: {
          balance_after_diamond: number;
          balance_after_heart: number;
          created_at: string;
          currency_type: Database['public']['Enums']['wallet_currency'];
          delta: number;
          id: string;
          metadata: Json;
          reason: Database['public']['Enums']['wallet_reason'];
          ref_id: string | null;
          ref_type: string | null;
          revenuecat_transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          balance_after_diamond: number;
          balance_after_heart: number;
          created_at?: string;
          currency_type: Database['public']['Enums']['wallet_currency'];
          delta: number;
          id?: string;
          metadata?: Json;
          reason: Database['public']['Enums']['wallet_reason'];
          ref_id?: string | null;
          ref_type?: string | null;
          revenuecat_transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          balance_after_diamond?: number;
          balance_after_heart?: number;
          created_at?: string;
          currency_type?: Database['public']['Enums']['wallet_currency'];
          delta?: number;
          id?: string;
          metadata?: Json;
          reason?: Database['public']['Enums']['wallet_reason'];
          ref_id?: string | null;
          ref_type?: string | null;
          revenuecat_transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_ledger_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      wallets: {
        Row: {
          diamond_balance: number;
          heart_balance: number;
          lifetime_purchased_diamonds: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          diamond_balance?: number;
          heart_balance?: number;
          lifetime_purchased_diamonds?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          diamond_balance?: number;
          heart_balance?: number;
          lifetime_purchased_diamonds?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      work_logs: {
        Row: {
          application_id: string | null;
          assignment_group_id: string | null;
          check_in_ts: string | null;
          check_out_ts: string | null;
          created_at: string | null;
          custom_allowances: Json | null;
          custom_role: string | null;
          custom_salary_info: Json | null;
          custom_tax_settings: Json | null;
          date: string;
          has_time_modification_logs: boolean | null;
          id: string;
          is_fixed_posting: boolean | null;
          job_posting_id: string;
          modification_history: Json | null;
          no_show_at: Json | null;
          no_show_reason: string | null;
          notes: string | null;
          owner_id: string | null;
          payroll_amount: number | null;
          payroll_date: string | null;
          payroll_notes: string | null;
          payroll_status: Database['public']['Enums']['payroll_status'] | null;
          role: Database['public']['Enums']['staff_role'];
          role_change_history: Json | null;
          settlement_modification_history: Json | null;
          staff_id: string;
          staff_name: string | null;
          staff_nickname: string | null;
          staff_photo_url: string | null;
          staff_photo_url_blurhash: string | null;
          status: Database['public']['Enums']['work_log_status'];
          time_slot: string | null;
          updated_at: string | null;
          work_duration: number | null;
        };
        Insert: {
          application_id?: string | null;
          assignment_group_id?: string | null;
          check_in_ts?: string | null;
          check_out_ts?: string | null;
          created_at?: string | null;
          custom_allowances?: Json | null;
          custom_role?: string | null;
          custom_salary_info?: Json | null;
          custom_tax_settings?: Json | null;
          date: string;
          has_time_modification_logs?: boolean | null;
          id?: string;
          is_fixed_posting?: boolean | null;
          job_posting_id: string;
          modification_history?: Json | null;
          no_show_at?: Json | null;
          no_show_reason?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          payroll_amount?: number | null;
          payroll_date?: string | null;
          payroll_notes?: string | null;
          payroll_status?: Database['public']['Enums']['payroll_status'] | null;
          role?: Database['public']['Enums']['staff_role'];
          role_change_history?: Json | null;
          settlement_modification_history?: Json | null;
          staff_id: string;
          staff_name?: string | null;
          staff_nickname?: string | null;
          staff_photo_url?: string | null;
          staff_photo_url_blurhash?: string | null;
          status?: Database['public']['Enums']['work_log_status'];
          time_slot?: string | null;
          updated_at?: string | null;
          work_duration?: number | null;
        };
        Update: {
          application_id?: string | null;
          assignment_group_id?: string | null;
          check_in_ts?: string | null;
          check_out_ts?: string | null;
          created_at?: string | null;
          custom_allowances?: Json | null;
          custom_role?: string | null;
          custom_salary_info?: Json | null;
          custom_tax_settings?: Json | null;
          date?: string;
          has_time_modification_logs?: boolean | null;
          id?: string;
          is_fixed_posting?: boolean | null;
          job_posting_id?: string;
          modification_history?: Json | null;
          no_show_at?: Json | null;
          no_show_reason?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          payroll_amount?: number | null;
          payroll_date?: string | null;
          payroll_notes?: string | null;
          payroll_status?: Database['public']['Enums']['payroll_status'] | null;
          role?: Database['public']['Enums']['staff_role'];
          role_change_history?: Json | null;
          settlement_modification_history?: Json | null;
          staff_id?: string;
          staff_name?: string | null;
          staff_nickname?: string | null;
          staff_photo_url?: string | null;
          staff_photo_url_blurhash?: string | null;
          status?: Database['public']['Enums']['work_log_status'];
          time_slot?: string | null;
          updated_at?: string | null;
          work_duration?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'work_logs_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_logs_job_posting_id_fkey';
            columns: ['job_posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_logs_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_logs_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          invited_by: string;
          invitee_user_id: string;
          responded_at: string | null;
          role: Database['public']['Enums']['workspace_role'];
          status: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          invitee_user_id: string;
          responded_at?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          status?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          invitee_user_id?: string;
          responded_at?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_invitations_invitee_user_id_fkey';
            columns: ['invitee_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          invited_by: string | null;
          joined_at: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          invited_by?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          invited_by?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          member_count: number;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_count?: number;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_count?: number;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _build_schedule_board_body: {
        Args: { p_jp: Database['public']['Tables']['job_postings']['Row'] };
        Returns: string;
      };
      _fmt_worklog_time: { Args: { p_ts: string }; Returns: string };
      _format_compensation_label: {
        Args: { p_compensation: Json };
        Returns: string;
      };
      accept_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      apply_with_capacity_check: {
        Args: {
          p_applicant_email?: string;
          p_applicant_id: string;
          p_applicant_name: string;
          p_applicant_nickname?: string;
          p_applicant_phone?: string;
          p_applicant_photo_url?: string;
          p_applicant_role?: string;
          p_assignments?: Json;
          p_custom_role?: string;
          p_job_posting_date?: string;
          p_job_posting_id: string;
          p_job_posting_title?: string;
          p_message?: string;
          p_pre_question_answers?: Json;
          p_recruitment_type?: string;
        };
        Returns: Json;
      };
      approve_employer_application: {
        Args: { p_app_id: string };
        Returns: Json;
      };
      cancel_application_atomically: {
        Args: {
          p_actor_id: string;
          p_actor_type: string;
          p_application_id: string;
          p_cancel_reason?: string;
          p_rejection_reason?: string;
        };
        Returns: Json;
      };
      check_email_exists: { Args: { p_email: string }; Returns: boolean };
      check_ip_rate_limit: {
        Args: {
          p_ip: string;
          p_max_requests?: number;
          p_window_seconds?: number;
        };
        Returns: Json;
      };
      check_nickname_exists: {
        Args: { p_exclude_uid?: string; p_nickname: string };
        Returns: boolean;
      };
      check_phone_exists: { Args: { p_phone: string }; Returns: boolean };
      check_rate_limit: {
        Args: {
          p_key: string;
          p_max_requests?: number;
          p_window_seconds?: number;
        };
        Returns: Json;
      };
      check_user_rate_limit: {
        Args: {
          p_max_requests?: number;
          p_operation: string;
          p_user_id: string;
          p_window_seconds?: number;
        };
        Returns: Json;
      };
      claim_daily_attendance: { Args: never; Returns: Json };
      confirm_application: {
        Args: {
          p_application_id: string;
          p_assignments?: Json;
          p_assignments_v3?: Json;
          p_confirmation_history?: Json;
          p_is_fixed_posting?: boolean;
          p_notes?: string;
          p_original_application?: Json;
          p_owner_id: string;
        };
        Returns: Json;
      };
      consume_diamonds_atomically: {
        Args: {
          p_amount: number;
          p_reason: Database['public']['Enums']['wallet_reason'];
          p_ref_id: string;
          p_ref_type: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      create_job_posting_with_payment_atomically: {
        Args: {
          p_cost_diamonds: number;
          p_owner_id: string;
          p_posting_payload: Json;
          p_reason: Database['public']['Enums']['wallet_reason'];
        };
        Returns: Json;
      };
      create_report: {
        Args: {
          p_description: string;
          p_evidence_urls: string[];
          p_job_posting_id: string;
          p_job_posting_title: string;
          p_reporter_id: string;
          p_reporter_name: string;
          p_reporter_type: string;
          p_severity: Database['public']['Enums']['report_severity'];
          p_target_id: string;
          p_target_name: string;
          p_type: string;
          p_work_date?: string;
          p_work_log_id?: string;
        };
        Returns: Json;
      };
      create_workspace: {
        Args: { p_name: string };
        Returns: {
          created_at: string;
          id: string;
          member_count: number;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      credit_diamonds_atomically: {
        Args: {
          p_diamonds: number;
          p_product_id: string;
          p_revenuecat_transaction_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      decrement_unread_counter:
        | { Args: { p_notification_id: string }; Returns: undefined }
        | { Args: { p_delta?: number; p_user_id: string }; Returns: undefined };
      expire_pending_workspace_invitations: { Args: never; Returns: number };
      fn_cleanup_expired_fcm_tokens: { Args: never; Returns: number };
      fn_cleanup_rate_limits: { Args: never; Returns: number };
      fn_expire_by_last_work_date: { Args: never; Returns: number };
      fn_expire_fixed_postings_batch: { Args: never; Returns: number };
      fn_expire_heart_lots: { Args: never; Returns: Json };
      fn_send_review_reminders: { Args: never; Returns: number };
      get_job_posting_stats: {
        Args: { p_owner_id: string };
        Returns: {
          active: number;
          cancelled: number;
          closed: number;
          total: number;
          total_applications: number;
          total_views: number;
        }[];
      };
      get_latest_employer_application: {
        Args: { p_user_id?: string };
        Returns: Json;
      };
      get_my_role: { Args: never; Returns: string };
      get_regular_posting_date_counts: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          posting_count: number;
          work_date: string;
        }[];
      };
      get_unread_notification_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_wallet_summary: { Args: { p_user_id?: string }; Returns: Json };
      get_workspace_owner_profile: {
        Args: { _workspace_id: string };
        Returns: {
          id: string;
          name: string;
          nickname: string;
          photo_url: string;
        }[];
      };
      grant_heart_atomically: {
        Args: {
          p_amount: number;
          p_expires_in_days?: number;
          p_reason: Database['public']['Enums']['wallet_reason'];
          p_source_ref_id?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      increment_announcement_view_count: {
        Args: { p_announcement_id: string };
        Returns: undefined;
      };
      increment_board_post_view_count: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      increment_template_usage: {
        Args: { p_template_id: string };
        Returns: undefined;
      };
      increment_view_count: { Args: { posting_id: string }; Returns: undefined };
      invite_workspace_member: {
        Args: { p_invitee_user_id: string; p_workspace_id: string };
        Returns: string;
      };
      is_admin: { Args: never; Returns: boolean };
      is_employer_or_admin: { Args: never; Returns: boolean };
      is_posting_collaborator: {
        Args: { p_posting_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_workspace_jpc_member: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
      list_all_applications: {
        Args: { p_status?: Database['public']['Enums']['application_status'] };
        Returns: {
          applicant_email: string | null;
          applicant_id: string;
          applicant_name: string;
          applicant_nickname: string | null;
          applicant_phone: string | null;
          applicant_photo_url: string | null;
          applicant_photo_url_blurhash: string | null;
          applicant_provision_consent_at: string | null;
          applicant_provision_consent_version: string | null;
          applicant_role: Database['public']['Enums']['staff_role'] | null;
          assignments: Json | null;
          cancellation_request: Json | null;
          cancelled_at: string | null;
          confirmation_history: Json | null;
          confirmed_at: string | null;
          created_at: string | null;
          custom_role: string | null;
          id: string;
          is_read: boolean | null;
          job_posting_date: string | null;
          job_posting_id: string;
          job_posting_title: string | null;
          message: string | null;
          notes: string | null;
          original_application: Json | null;
          pre_question_answers: Json | null;
          processed_at: string | null;
          processed_by: string | null;
          recruitment_type: string | null;
          rejection_reason: string | null;
          status: Database['public']['Enums']['application_status'];
          updated_at: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'applications';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_all_event_qr_codes: {
        Args: { p_active?: boolean };
        Returns: {
          assignment_group_id: string | null;
          code: string;
          created_at: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          job_posting_id: string;
          time_slot: string | null;
          type: string;
          user_id: string;
          work_date: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'event_qr_codes';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_all_managed_postings: {
        Args: { p_status?: Database['public']['Enums']['posting_status'] };
        Returns: {
          closed_at: string | null;
          closed_reason: string | null;
          compensation: Json | null;
          contact_phone: string | null;
          created_at: string | null;
          description: string | null;
          filled_positions: number | null;
          fixed_config: Json | null;
          id: string;
          is_featured: boolean | null;
          last_work_date: string | null;
          location: Json;
          og_image_url: string | null;
          og_image_url_blurhash: string | null;
          owner_id: string | null;
          owner_name: string | null;
          posting_type: Database['public']['Enums']['posting_type'] | null;
          questions: Json | null;
          rejection_reason: string | null;
          role_catalog: Json | null;
          role_keys: string[] | null;
          schedule: Json;
          schema_version: number | null;
          stats: Json | null;
          status: Database['public']['Enums']['posting_status'];
          tags: string[] | null;
          title: string;
          total_positions: number | null;
          tournament_config: Json | null;
          updated_at: string | null;
          urgent_config: Json | null;
          view_count: number | null;
          work_date: string | null;
          work_dates: string[] | null;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'job_postings';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_all_work_logs: {
        Args: {
          p_date_from?: string;
          p_date_to?: string;
          p_status?: Database['public']['Enums']['work_log_status'];
        };
        Returns: {
          application_id: string | null;
          assignment_group_id: string | null;
          check_in_ts: string | null;
          check_out_ts: string | null;
          created_at: string | null;
          custom_allowances: Json | null;
          custom_role: string | null;
          custom_salary_info: Json | null;
          custom_tax_settings: Json | null;
          date: string;
          has_time_modification_logs: boolean | null;
          id: string;
          is_fixed_posting: boolean | null;
          job_posting_id: string;
          modification_history: Json | null;
          no_show_at: Json | null;
          no_show_reason: string | null;
          notes: string | null;
          owner_id: string | null;
          payroll_amount: number | null;
          payroll_date: string | null;
          payroll_notes: string | null;
          payroll_status: Database['public']['Enums']['payroll_status'] | null;
          role: Database['public']['Enums']['staff_role'];
          role_change_history: Json | null;
          settlement_modification_history: Json | null;
          staff_id: string;
          staff_name: string | null;
          staff_nickname: string | null;
          staff_photo_url: string | null;
          staff_photo_url_blurhash: string | null;
          status: Database['public']['Enums']['work_log_status'];
          time_slot: string | null;
          updated_at: string | null;
          work_duration: number | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'work_logs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_all_workspace_members: {
        Args: { p_workspace_id?: string };
        Returns: {
          invited_by: string | null;
          joined_at: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'workspace_members';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_my_workspaces: {
        Args: never;
        Returns: {
          created_at: string;
          id: string;
          member_count: number;
          name: string;
          owner_id: string;
          updated_at: string;
        }[];
      };
      permanently_delete_user: { Args: { p_user_id: string }; Returns: Json };
      process_qr_checkin_atomically: {
        Args: {
          p_action: string;
          p_check_time?: string;
          p_expected_date?: string;
          p_job_posting_id: string;
          p_staff_id: string;
          p_work_log_id: string;
        };
        Returns: Json;
      };
      refund_job_cancellation_atomically: {
        Args: { p_owner_id: string; p_posting_id: string };
        Returns: Json;
      };
      register_as_employer: {
        Args: { p_employer_agreements?: Json; p_intro?: string };
        Returns: Json;
      };
      reject_employer_application: {
        Args: { p_app_id: string; p_category?: string; p_reason?: string };
        Returns: Json;
      };
      reject_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      remove_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string };
        Returns: undefined;
      };
      reset_unread_counter: { Args: { p_user_id: string }; Returns: undefined };
      review_report: {
        Args: {
          p_report_id: string;
          p_reviewer_id: string;
          p_reviewer_notes?: string;
          p_status: string;
        };
        Returns: undefined;
      };
      revoke_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      search_users_for_collaborator_invite: {
        Args: { p_email_query: string; p_job_posting_id: string };
        Returns: {
          email: string;
          id: string;
          name: string;
          nickname: string;
          photo_url: string;
        }[];
      };
      sync_schedule_board: { Args: { p_job_posting_id: string }; Returns: Json };
      toggle_board_post_vote: {
        Args: { p_post_id: string; p_user_id: string; p_vote_type: string };
        Returns: Json;
      };
      toggle_comment_reaction: {
        Args: {
          p_comment_id: string;
          p_post_id: string;
          p_reaction_type: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_user_role: {
        Args: { p_new_role: string; p_user_id: string };
        Returns: Json;
      };
      workspace_count_for_owner: {
        Args: { _owner_id: string };
        Returns: number;
      };
    };
    Enums: {
      announcement_category: 'notice' | 'update' | 'event' | 'maintenance';
      announcement_status: 'draft' | 'published' | 'archived';
      application_status:
        | 'applied'
        | 'confirmed'
        | 'rejected'
        | 'cancelled'
        | 'completed'
        | 'cancellation_pending';
      board_type: 'notice' | 'schedule' | 'free' | 'tda' | 'substitute';
      inquiry_status: 'open' | 'in_progress' | 'closed';
      notification_category:
        | 'application'
        | 'attendance'
        | 'settlement'
        | 'job'
        | 'system'
        | 'admin'
        | 'review';
      payroll_status: 'pending' | 'completed' | 'failed';
      posting_status:
        | 'draft'
        | 'pending'
        | 'approved'
        | 'active'
        | 'capacity_full'
        | 'closed'
        | 'cancelled'
        | 'expired'
        | 'rejected';
      posting_type: 'regular' | 'fixed' | 'tournament' | 'urgent';
      report_severity: 'low' | 'medium' | 'high' | 'critical';
      review_sentiment: 'positive' | 'neutral' | 'negative';
      staff_role: 'dealer' | 'floor' | 'serving' | 'manager' | 'staff' | 'other';
      user_role: 'admin' | 'employer' | 'staff';
      wallet_currency: 'heart' | 'diamond';
      wallet_reason:
        | 'purchase'
        | 'consume_job_posting'
        | 'consume_job_extend'
        | 'consume_job_upgrade'
        | 'refund_purchase'
        | 'refund_job_cancelled'
        | 'grant_signup'
        | 'grant_daily_attendance'
        | 'grant_streak_7d'
        | 'grant_review'
        | 'grant_referral'
        | 'grant_admin'
        | 'grant_first_purchase_bonus'
        | 'expire_heart';
      work_log_status:
        | 'scheduled'
        | 'checked_in'
        | 'checked_out'
        | 'completed'
        | 'cancelled'
        | 'no_show';
      workspace_role: 'editor';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      announcement_category: ['notice', 'update', 'event', 'maintenance'],
      announcement_status: ['draft', 'published', 'archived'],
      application_status: [
        'applied',
        'confirmed',
        'rejected',
        'cancelled',
        'completed',
        'cancellation_pending',
      ],
      board_type: ['notice', 'schedule', 'free', 'tda', 'substitute'],
      inquiry_status: ['open', 'in_progress', 'closed'],
      notification_category: [
        'application',
        'attendance',
        'settlement',
        'job',
        'system',
        'admin',
        'review',
      ],
      payroll_status: ['pending', 'completed', 'failed'],
      posting_status: [
        'draft',
        'pending',
        'approved',
        'active',
        'capacity_full',
        'closed',
        'cancelled',
        'expired',
        'rejected',
      ],
      posting_type: ['regular', 'fixed', 'tournament', 'urgent'],
      report_severity: ['low', 'medium', 'high', 'critical'],
      review_sentiment: ['positive', 'neutral', 'negative'],
      staff_role: ['dealer', 'floor', 'serving', 'manager', 'staff', 'other'],
      user_role: ['admin', 'employer', 'staff'],
      wallet_currency: ['heart', 'diamond'],
      wallet_reason: [
        'purchase',
        'consume_job_posting',
        'consume_job_extend',
        'consume_job_upgrade',
        'refund_purchase',
        'refund_job_cancelled',
        'grant_signup',
        'grant_daily_attendance',
        'grant_streak_7d',
        'grant_review',
        'grant_referral',
        'grant_admin',
        'grant_first_purchase_bonus',
        'expire_heart',
      ],
      work_log_status: [
        'scheduled',
        'checked_in',
        'checked_out',
        'completed',
        'cancelled',
        'no_show',
      ],
      workspace_role: ['editor'],
    },
  },
} as const;
