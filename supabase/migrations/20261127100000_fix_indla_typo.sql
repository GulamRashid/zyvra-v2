-- Fix typo 'Indla' -> 'India' in folders and chapters titles
UPDATE public.folders
SET title = replace(title, 'Indla', 'India'),
    updated_at = now()
WHERE title LIKE '%Indla%';

UPDATE public.chapters
SET title = replace(title, 'Indla', 'India'),
    updated_at = now()
WHERE title LIKE '%Indla%';
