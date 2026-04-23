import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphVizData, GraphVizLink, GraphVizNode } from '@/social-graph/types/graph'
import { Spinner } from '@/components/ui/spinner'

const ForceGraph2D = lazy(async () => {
  const mod = await import('react-force-graph-2d')
  return { default: mod.default }
})

type Props = {
  data: GraphVizData
}

export function SocialGraphForceView({ data }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 640, h: 440 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const cr = el.getBoundingClientRect()
      setDims({
        w: Math.max(280, Math.floor(cr.width)),
        h: Math.max(280, Math.floor(cr.height)),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data]
  )

  const nodeColor = useCallback((n: object) => {
    const node = n as GraphVizNode
    if (node.isCenter) return 'rgb(99, 102, 241)'
    const h = node.hopFromCenter < 0 ? 6 : Math.min(node.hopFromCenter, 8)
    const g = 200 - h * 20
    const t = node.sybilRank01 ?? 0
    return `rgb(${Math.min(255, Math.round(90 + h * 14 + t * 55))}, ${Math.max(40, Math.round(g - t * 45))}, ${Math.min(255, Math.round(215 + t * 30))})`
  }, [])

  const linkWidth = useCallback((l: object) => {
    const link = l as GraphVizLink
    return 0.5 + Math.sqrt(Math.max(0.01, link.weight)) * 2.4
  }, [])

  const nodeLabel = useCallback((n: object) => {
    const node = n as GraphVizNode
    const hop = node.hopFromCenter < 0 ? '?' : String(node.hopFromCenter)
    const sr =
      node.sybilRank01 !== undefined ? `\nTier-SybilRank: ${(node.sybilRank01 * 100).toFixed(1)}%` : ''
    return `${node.id}\nSaltos desde centro: ${hop}\nGrado: ${node.degree}${sr}${node.isCenter ? '\n(Centro)' : ''}`
  }, [])

  const linkLabel = useCallback((l: object) => {
    const link = l as GraphVizLink
    const mh = link.minHopFromCenter < 0 ? '?' : String(link.minHopFromCenter)
    return (
      `tier ${link.trustTier} · frescura ${(link.freshness * 100).toFixed(0)}%\n` +
      `peso ${link.weight.toFixed(2)} · min hops (extremos→centro): ${mh}`
    )
  }, [])

  return (
    <div
      ref={wrapRef}
      className="h-[min(70vh,520px)] w-full min-h-[280px] overflow-hidden rounded-md border bg-muted/10"
    >
      <Suspense
        fallback={
          <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner className="size-6" />
            Cargando motor de grafo…
          </div>
        }
      >
        <ForceGraph2D
          width={dims.w}
          height={dims.h}
          graphData={graphData}
          nodeId="id"
          nodeLabel={nodeLabel}
          nodeVal="val"
          nodeColor={nodeColor}
          linkLabel={linkLabel}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.08}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.35}
          backgroundColor="rgba(0,0,0,0)"
        />
      </Suspense>
    </div>
  )
}
