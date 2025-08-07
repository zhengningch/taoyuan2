-- Create excerpts table for storing user excerpts
CREATE TABLE IF NOT EXISTS excerpts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  notes TEXT, -- Store essay/notes content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_excerpts_user_id ON excerpts(user_id);
CREATE INDEX IF NOT EXISTS idx_excerpts_created_at ON excerpts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE excerpts ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only access their own excerpts
CREATE POLICY "Users can view their own excerpts" ON excerpts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own excerpts" ON excerpts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own excerpts" ON excerpts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own excerpts" ON excerpts
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_excerpts_updated_at
  BEFORE UPDATE ON excerpts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();