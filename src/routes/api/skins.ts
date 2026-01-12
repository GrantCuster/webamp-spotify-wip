import { createFileRoute } from '@tanstack/react-router'
import { getSkins } from '../../db/queries'

export const Route = createFileRoute('/api/skins')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const limit = url.searchParams.get('limit')
            ? parseInt(url.searchParams.get('limit')!)
            : undefined
          const offset = url.searchParams.get('offset')
            ? parseInt(url.searchParams.get('offset')!)
            : undefined
          const liked = url.searchParams.get('liked')
            ? url.searchParams.get('liked') === 'true'
            : undefined
          const flagged = url.searchParams.get('flagged')
            ? url.searchParams.get('flagged') === 'true'
            : undefined
          const minRating = url.searchParams.get('minRating')
            ? parseInt(url.searchParams.get('minRating')!)
            : undefined

          const skins = await getSkins({
            limit,
            offset,
            liked,
            flagged,
            minRating,
            orderBy: 'created_at',
            orderDirection: 'desc',
          })

          return new Response(JSON.stringify({ skins }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (error) {
          console.error('Error fetching skins:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch skins' }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        }
      },
    },
  },
})
