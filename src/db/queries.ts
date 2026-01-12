import { sql, Skin, CreateSkinInput, UpdateSkinInput } from './client';

// Get all skins with optional filtering
export interface GetSkinsOptions {
  liked?: boolean;
  flagged?: boolean;
  tweeted?: boolean;
  minRating?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'last_used_at' | 'rating' | 'use_count';
  orderDirection?: 'asc' | 'desc';
}

export async function getSkins(options: GetSkinsOptions = {}): Promise<Skin[]> {
  const {
    liked,
    flagged,
    tweeted,
    minRating,
    limit,
    offset = 0,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options;

  let query = sql`
    SELECT * FROM skins
    WHERE 1=1
  `;

  if (liked !== undefined) {
    query = sql`${query} AND liked = ${liked}`;
  }
  if (flagged !== undefined) {
    query = sql`${query} AND flagged = ${flagged}`;
  }
  if (tweeted !== undefined) {
    query = sql`${query} AND tweeted = ${tweeted}`;
  }
  if (minRating !== undefined) {
    query = sql`${query} AND rating >= ${minRating}`;
  }

  query = sql`${query} ORDER BY ${sql(orderBy)} ${sql.unsafe(orderDirection.toUpperCase())}`;

  if (limit) {
    query = sql`${query} LIMIT ${limit} OFFSET ${offset}`;
  }

  return await query as Skin[];
}

// Get a single skin by ID
export async function getSkinById(id: number): Promise<Skin | null> {
  const result = await sql<Skin[]>`
    SELECT * FROM skins WHERE id = ${id}
  `;
  return result[0] || null;
}

// Get a single skin by MD5
export async function getSkinByMd5(md5: string): Promise<Skin | null> {
  const result = await sql<Skin[]>`
    SELECT * FROM skins WHERE md5 = ${md5}
  `;
  return result[0] || null;
}

// Create a new skin (or ignore if MD5 already exists)
export async function createSkin(input: CreateSkinInput): Promise<Skin | null> {
  const {
    md5,
    filename,
    filepath,
    nsfw = false,
    tweeted = false,
    average_color,
    screenshot_url,
    museum_url,
    file_size,
  } = input;

  const result = await sql<Skin[]>`
    INSERT INTO skins (
      md5,
      filename,
      filepath,
      nsfw,
      tweeted,
      average_color,
      screenshot_url,
      museum_url,
      file_size
    )
    VALUES (
      ${md5},
      ${filename},
      ${filepath},
      ${nsfw},
      ${tweeted},
      ${average_color ?? null},
      ${screenshot_url ?? null},
      ${museum_url ?? null},
      ${file_size ?? null}
    )
    ON CONFLICT (md5) DO NOTHING
    RETURNING *
  `;

  return result[0] || null;
}

// Update a skin
export async function updateSkin(
  id: number,
  input: UpdateSkinInput
): Promise<Skin | null> {
  const updates: string[] = [];
  const values: any[] = [];

  if (input.liked !== undefined) {
    updates.push('liked');
    values.push(input.liked);
  }
  if (input.flagged !== undefined) {
    updates.push('flagged');
    values.push(input.flagged);
  }
  if (input.tags !== undefined) {
    updates.push('tags');
    values.push(JSON.stringify(input.tags));
  }
  if (input.notes !== undefined) {
    updates.push('notes');
    values.push(input.notes);
  }
  if (input.rating !== undefined) {
    updates.push('rating');
    values.push(input.rating);
  }
  if (input.last_used_at !== undefined) {
    updates.push('last_used_at');
    values.push(input.last_used_at);
  }
  if (input.use_count !== undefined) {
    updates.push('use_count');
    values.push(input.use_count);
  }

  if (updates.length === 0) {
    return await getSkinById(id);
  }

  const setClause = updates.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const result = await sql.unsafe<Skin[]>(
    `UPDATE skins SET ${setClause} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  return result[0] || null;
}

// Increment use count and update last used time
export async function trackSkinUsage(id: number): Promise<Skin | null> {
  const result = await sql<Skin[]>`
    UPDATE skins
    SET use_count = use_count + 1,
        last_used_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] || null;
}

// Delete a skin
export async function deleteSkin(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM skins WHERE id = ${id}
  `;
  return result.count > 0;
}

// Count total skins
export async function countSkins(options: GetSkinsOptions = {}): Promise<number> {
  const { liked, flagged, tweeted, minRating } = options;

  let query = sql`SELECT COUNT(*) as count FROM skins WHERE 1=1`;

  if (liked !== undefined) {
    query = sql`${query} AND liked = ${liked}`;
  }
  if (flagged !== undefined) {
    query = sql`${query} AND flagged = ${flagged}`;
  }
  if (tweeted !== undefined) {
    query = sql`${query} AND tweeted = ${tweeted}`;
  }
  if (minRating !== undefined) {
    query = sql`${query} AND rating >= ${minRating}`;
  }

  const result = await query;
  return Number(result[0].count);
}

// Get a random skin (for shuffling)
export async function getRandomSkin(excludeId?: number): Promise<Skin | null> {
  let query = sql`
    SELECT * FROM skins
    WHERE 1=1
  `;

  if (excludeId !== undefined) {
    query = sql`${query} AND id != ${excludeId}`;
  }

  query = sql`${query} ORDER BY RANDOM() LIMIT 1`;

  const result = await query as Skin[];
  return result[0] || null;
}

// Update S3 information for a skin
export async function updateSkinS3(
  id: number,
  s3_key: string
): Promise<Skin | null> {
  const result = await sql<Skin[]>`
    UPDATE skins
    SET s3_key = ${s3_key},
        s3_uploaded_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] || null;
}

// Get skins without S3 upload (for bulk upload)
export async function getSkinsWithoutS3(limit?: number): Promise<Skin[]> {
  let query = sql`
    SELECT * FROM skins
    WHERE s3_key IS NULL
    ORDER BY created_at ASC
  `;

  if (limit) {
    query = sql`${query} LIMIT ${limit}`;
  }

  return await query as Skin[];
}

// Get skins with S3 upload (for cleanup)
export async function getSkinsWithS3(limit?: number): Promise<Skin[]> {
  let query = sql`
    SELECT * FROM skins
    WHERE s3_key IS NOT NULL
    ORDER BY s3_uploaded_at ASC
  `;

  if (limit) {
    query = sql`${query} LIMIT ${limit}`;
  }

  return await query as Skin[];
}
