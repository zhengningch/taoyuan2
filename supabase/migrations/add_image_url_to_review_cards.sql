-- Add image_url column to review_cards table
ALTER TABLE review_cards ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN review_cards.image_url IS 'URL of the generated image for the review card';