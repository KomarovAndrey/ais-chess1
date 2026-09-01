-- Soft Skills: teacher comment on weekly discipline entry.
alter table public.soft_skills_discipline_entries
  add column if not exists teacher_note text;

comment on column public.soft_skills_discipline_entries.teacher_note is
  'Optional staff comment for the week/discipline entry (max ~500 chars in app).';
