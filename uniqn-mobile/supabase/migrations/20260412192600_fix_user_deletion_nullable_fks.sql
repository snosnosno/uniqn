-- Migration: fix_user_deletion_nullable_fks
-- Date: 2026-04-12
-- Issue: ISSUE-006 — permanently_delete_user에서 NOT NULL FK 컬럼 처리 불가
-- Fix: 콘텐츠 보존이 필요한 FK 컬럼들을 nullable로 변경하여
--      회원탈퇴 시 익명화(NULL 처리) 가능하도록 수정

-- 공지사항: 작성자 삭제 시 익명 처리 (콘텐츠 보존)
ALTER TABLE public.announcements ALTER COLUMN author_id DROP NOT NULL;

-- 게시판 게시물: 작성자 삭제 시 익명 처리 (콘텐츠 보존)
ALTER TABLE public.board_posts ALTER COLUMN author_id DROP NOT NULL;

-- 게시판 댓글: 작성자 삭제 시 익명 처리 (콘텐츠 보존)
ALTER TABLE public.board_comments ALTER COLUMN author_id DROP NOT NULL;

-- 문의사항: 사용자 데이터이므로 익명화 허용
ALTER TABLE public.inquiries ALTER COLUMN user_id DROP NOT NULL;

-- 신고: 신고자 정보 익명화 가능하도록 nullable
ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;

-- 게시판 신고: 신고자 정보 익명화 가능하도록 nullable
ALTER TABLE public.board_reports ALTER COLUMN reporter_id DROP NOT NULL;
