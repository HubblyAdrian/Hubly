-- Drop the temporary measurement helper from 20260822100000. It did its one job
-- (quantifying the palette default) and should not linger — it can read any
-- stored page's background regardless of ownership.
drop function if exists public._measure_page_backgrounds();
