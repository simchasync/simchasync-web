-- venue_type categorizes the venue (hotel, function_hall, banquet_hall, garden,
-- synagogue, restaurant, country_club, private_residence) or holds a free-text
-- custom label when the user picks "Other" in the Venue Type selector.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_type text;
