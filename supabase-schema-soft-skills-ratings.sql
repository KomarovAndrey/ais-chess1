-- Таблица для хранения оценок по Soft Skills

-- 1. Создать таблицу soft_skills_ratings
CREATE TABLE IF NOT EXISTS soft_skills_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Кто оценивает (должен быть teacher или admin)
  evaluator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Кого оценивают
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Оценки по компетенциям (1-5 звёзд или '-' если пропущено)
  leadership text CHECK (leadership IN ('1', '2', '3', '4', '5', '-')),
  communication text CHECK (communication IN ('1', '2', '3', '4', '5', '-')),
  self_reflection text CHECK (self_reflection IN ('1', '2', '3', '4', '5', '-')),
  critical_thinking text CHECK (critical_thinking IN ('1', '2', '3', '4', '5', '-')),
  self_control text CHECK (self_control IN ('1', '2', '3', '4', '5', '-')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Индексы
CREATE INDEX IF NOT EXISTS soft_skills_ratings_evaluator_idx ON soft_skills_ratings(evaluator_id);
CREATE INDEX IF NOT EXISTS soft_skills_ratings_student_idx ON soft_skills_ratings(student_id);
CREATE INDEX IF NOT EXISTS soft_skills_ratings_created_at_idx ON soft_skills_ratings(created_at DESC);

-- 3. Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_soft_skills_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS soft_skills_ratings_updated_at ON soft_skills_ratings;
CREATE TRIGGER soft_skills_ratings_updated_at
  BEFORE UPDATE ON soft_skills_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_soft_skills_ratings_updated_at();

-- 4. Row Level Security (RLS)
ALTER TABLE soft_skills_ratings ENABLE ROW LEVEL SECURITY;

-- Политика: учителя и админы могут создавать оценки
CREATE POLICY "Teachers and admins can insert ratings"
  ON soft_skills_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('teacher', 'admin')
    )
  );

-- Политика: учителя и админы могут читать все оценки
CREATE POLICY "Teachers and admins can view all ratings"
  ON soft_skills_ratings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('teacher', 'admin')
    )
  );

-- Политика: учителя и админы могут обновлять свои оценки
CREATE POLICY "Teachers and admins can update their ratings"
  ON soft_skills_ratings
  FOR UPDATE
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('teacher', 'admin')
    )
  );

-- Политика: учителя и админы могут удалять свои оценки
CREATE POLICY "Teachers and admins can delete their ratings"
  ON soft_skills_ratings
  FOR DELETE
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('teacher', 'admin')
    )
  );

COMMENT ON TABLE soft_skills_ratings IS 'Оценки учеников по Soft Skills компетенциям';
COMMENT ON COLUMN soft_skills_ratings.evaluator_id IS 'ID учителя/админа, который оценивает';
COMMENT ON COLUMN soft_skills_ratings.student_id IS 'ID ученика, которого оценивают';
COMMENT ON COLUMN soft_skills_ratings.leadership IS 'Лидерство (1-5 или -)';
COMMENT ON COLUMN soft_skills_ratings.communication IS 'Коммуникация (1-5 или -)';
COMMENT ON COLUMN soft_skills_ratings.self_reflection IS 'Саморефлексия (1-5 или -)';
COMMENT ON COLUMN soft_skills_ratings.critical_thinking IS 'Критическое мышление (1-5 или -)';
COMMENT ON COLUMN soft_skills_ratings.self_control IS 'Самоконтроль (1-5 или -)';
