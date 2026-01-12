import { createFileRoute } from '@tanstack/react-router'
import { getSkinById, updateSkin } from '../../db/queries'
import type { UpdateSkinInput } from '../../db/client'

export const Route = createFileRoute('/api/skins/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = parseInt(params.id)
          if (isNaN(id)) {
            return new Response(
              JSON.stringify({ error: 'Invalid skin ID' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }

          const skin = await getSkinById(id)

          if (!skin) {
            return new Response(
              JSON.stringify({ error: 'Skin not found' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }

          return new Response(JSON.stringify({ skin }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching skin:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch skin' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      },

      PATCH: async ({ params, request }) => {
        try {
          const id = parseInt(params.id)
          if (isNaN(id)) {
            return new Response(
              JSON.stringify({ error: 'Invalid skin ID' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }

          const body = await request.json()
          const updates: UpdateSkinInput = {}

          // Validate and extract allowed fields
          if (body.liked !== undefined) updates.liked = Boolean(body.liked)
          if (body.flagged !== undefined)
            updates.flagged = Boolean(body.flagged)
          if (body.tags !== undefined) {
            if (Array.isArray(body.tags)) {
              updates.tags = body.tags
            } else {
              return new Response(
                JSON.stringify({ error: 'Tags must be an array' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                }
              )
            }
          }
          if (body.notes !== undefined) updates.notes = String(body.notes)
          if (body.rating !== undefined) {
            const rating = parseInt(body.rating)
            if (isNaN(rating) || rating < 0 || rating > 5) {
              return new Response(
                JSON.stringify({
                  error: 'Rating must be between 0 and 5',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                }
              )
            }
            updates.rating = rating
          }
          if (body.last_used_at !== undefined) {
            updates.last_used_at = new Date(body.last_used_at)
          }
          if (body.use_count !== undefined) {
            const useCount = parseInt(body.use_count)
            if (isNaN(useCount) || useCount < 0) {
              return new Response(
                JSON.stringify({
                  error: 'Use count must be a non-negative integer',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                }
              )
            }
            updates.use_count = useCount
          }

          const updatedSkin = await updateSkin(id, updates)

          if (!updatedSkin) {
            return new Response(
              JSON.stringify({ error: 'Skin not found' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }

          return new Response(JSON.stringify({ skin: updatedSkin }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error updating skin:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update skin' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      },
    },
  },
})
