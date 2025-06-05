import { parsePathname, removeBasepath } from './path'
import type { AnyRoute } from './route'
import type { Segment } from './path'

export interface RouteMeta {
  route: AnyRoute
  fullPath: string
  routeId: string
}

export interface RouteMatch {
  route: AnyRoute
  params: Record<string, string>
  foundRoute: AnyRoute
}

interface TrieNode {
  staticChildren: Map<string, TrieNode>

  paramChildren: Array<{
    paramName: string
    node: TrieNode
  }>

  wildcardChild: TrieNode | null

  routes: Array<RouteMeta>

  segment?: string
  depth: number
}

export class RouteTrie {
  private root: TrieNode

  constructor() {
    this.root = this.createNode('', 0)
  }

  private createNode(segment: string, depth: number): TrieNode {
    return {
      staticChildren: new Map(),
      paramChildren: [],
      wildcardChild: null,
      routes: [],
      segment,
      depth,
    }
  }

  /**
   * Insert a route into the trie
   */
  insert(route: AnyRoute): void {
    if (!route.fullPath || route.fullPath === '/') {
      // Root route stored directly in root
      this.root.routes.push({
        route,
        fullPath: route.fullPath || '/',
        routeId: route.id,
      })
      return
    }

    const segments = parsePathname(route.fullPath)
    this.insertSegments(segments, route, this.root, 0)
  }

  private insertSegments(
    segments: Array<Segment>,
    route: AnyRoute,
    node: TrieNode,
    index: number,
  ): void {
    if (index >= segments.length) {
      // Reached end of path, store route info
      node.routes.push({
        route,
        fullPath: route.fullPath,
        routeId: route.id,
      })
      return
    }

    const segment = segments[index]!
    let nextNode: TrieNode

    switch (segment.type) {
      case 'pathname': {
        if (segment.value === '/') {
          // Skip slashes (already handled as path separators)
          this.insertSegments(segments, route, node, index + 1)
          return
        }

        if (!node.staticChildren.has(segment.value)) {
          node.staticChildren.set(
            segment.value,
            this.createNode(segment.value, node.depth + 1),
          )
        }
        const staticNode = node.staticChildren.get(segment.value)
        if (!staticNode) {
          throw new Error('Invalid state: static node should exist')
        }
        nextNode = staticNode
        break
      }

      case 'param': {
        const paramName = segment.value.substring(1)

        let paramChild = node.paramChildren.find(
          (p) => p.paramName === paramName,
        )
        if (!paramChild) {
          const newNode = this.createNode(segment.value, node.depth + 1)
          paramChild = { paramName, node: newNode }
          node.paramChildren.push(paramChild)
        }
        nextNode = paramChild.node
        break
      }

      case 'wildcard': {
        if (!node.wildcardChild) {
          node.wildcardChild = this.createNode(segment.value, node.depth + 1)
        }
        nextNode = node.wildcardChild
        break
      }

      default:
        throw new Error(
          `Unknown segment type: ${String((segment as unknown as Record<string, unknown>).type)}`,
        )
    }

    this.insertSegments(segments, route, nextNode, index + 1)
  }

  /**
   * Find routes matching the given pathname
   */
  match(
    pathname: string,
    options: {
      basepath?: string
      caseSensitive?: boolean
    } = {},
  ): {
    matchedRoutes: Array<AnyRoute>
    routeParams: Record<string, string>
    foundRoute: AnyRoute | undefined
  } {
    const { basepath = '/', caseSensitive = false } = options

    // Remove basepath
    let pathToMatch = pathname
    if (basepath !== '/') {
      pathToMatch = removeBasepath(basepath, pathname, caseSensitive)
    }

    const segments = parsePathname(pathToMatch)
    const matches: Array<{
      route: AnyRoute
      params: Record<string, string>
      depth: number
    }> = []

    this.matchSegments(segments, this.root, 0, {}, matches, caseSensitive)

    if (matches.length === 0) {
      return {
        matchedRoutes: [],
        routeParams: {},
        foundRoute: undefined,
      }
    }

    // Sort matches by specificity
    // 1. Deeper paths first
    // 2. More segments first
    // 3. Static matches over dynamic matches
    matches.sort((a, b) => {
      // Compare by depth
      if (a.depth !== b.depth) {
        return b.depth - a.depth
      }

      // Compare by segment count
      const aSegments = a.route.fullPath.split('/').filter(Boolean).length
      const bSegments = b.route.fullPath.split('/').filter(Boolean).length
      if (aSegments !== bSegments) {
        return bSegments - aSegments
      }

      // Static matches preferred over dynamic (fewer params = more static)
      const aParamCount = Object.keys(a.params).length
      const bParamCount = Object.keys(b.params).length
      return aParamCount - bParamCount
    })

    if (!matches.length || !matches[0]) {
      return {
        matchedRoutes: [],
        routeParams: {},
        foundRoute: undefined,
      }
    }

    const bestMatch = matches[0]
    const foundRoute = bestMatch.route

    // Build parent chain (same as original RouterCore logic)
    const matchedRoutes: Array<AnyRoute> = [foundRoute]
    let current: AnyRoute | undefined = foundRoute.parentRoute

    while (current) {
      matchedRoutes.unshift(current)
      current = current.parentRoute
    }

    return {
      matchedRoutes,
      routeParams: bestMatch.params,
      foundRoute,
    }
  }

  private matchSegments(
    segments: Array<Segment>,
    node: TrieNode,
    index: number,
    params: Record<string, string>,
    matches: Array<{
      route: AnyRoute
      params: Record<string, string>
      depth: number
    }>,
    caseSensitive: boolean = false,
  ): void {
    // If we've consumed all segments and found routes, add as matches
    if (index >= segments.length) {
      for (const routeMeta of node.routes) {
        matches.push({
          route: routeMeta.route,
          params: { ...params },
          depth: node.depth,
        })
      }
      return
    }

    const segment = segments[index]!

    // Skip slash segments
    if (segment.type === 'pathname' && segment.value === '/') {
      this.matchSegments(
        segments,
        node,
        index + 1,
        params,
        matches,
        caseSensitive,
      )
      return
    }

    // 1. Try static match first (highest priority)
    if (segment.type === 'pathname') {
      let staticChild: TrieNode | undefined

      if (caseSensitive) {
        staticChild = node.staticChildren.get(segment.value)
      } else {
        // Case-insensitive matching
        for (const [key, child] of node.staticChildren) {
          if (key.toLowerCase() === segment.value.toLowerCase()) {
            staticChild = child
            break
          }
        }
      }

      if (staticChild) {
        this.matchSegments(
          segments,
          staticChild,
          index + 1,
          params,
          matches,
          caseSensitive,
        )
      }
    }

    // 2. Try dynamic param matches
    if (segment.type === 'pathname' && segment.value !== '/') {
      for (const paramChild of node.paramChildren) {
        const newParams = {
          ...params,
          [paramChild.paramName]: decodeURIComponent(segment.value),
        }
        this.matchSegments(
          segments,
          paramChild.node,
          index + 1,
          newParams,
          matches,
          caseSensitive,
        )
      }
    }

    // 3. Try wildcard match (lowest priority)
    if (node.wildcardChild) {
      // Collect remaining segments for splat
      const remainingSegments = segments.slice(index)
      const remainingPath = remainingSegments
        .map((s) => s.value)
        .filter((v) => v !== '/') // Remove slashes
        .join('/')

      const splatParams = {
        ...params,
        '*': remainingPath,
        _splat: remainingPath,
      }

      // Wildcard consumes all remaining segments
      this.matchSegments(
        [],
        node.wildcardChild,
        segments.length,
        splatParams,
        matches,
        caseSensitive,
      )
    }
  }

  private getPrefix(level: number): string {
    if (level === 0) return ''
    if (level === 1) return '└─ '

    return `   ${'│  '.repeat(level - 2)}└─ `
  }

  /**
   * For debugging: print trie structure
   */
  debugRoutes(): Array<string> {
    const lines: Array<string> = []
    this.debugNode(this.root, '', lines)
    return lines
  }

  /**
   * For debugging: print trie structure as string
   */
  debug(): string {
    return this.debugRoutes().join('\n')
  }

  private debugNode(
    node: TrieNode,
    indent: string,
    lines: Array<string>,
  ): void {
    const prefix = this.getPrefix(node.depth)
    const routeInfo =
      node.routes.length > 0 ? ` (${node.routes.length} routes)` : ''
    lines.push(`${prefix}${node.segment || 'ROOT'}${routeInfo}`)

    // Static children
    for (const [key, child] of node.staticChildren) {
      this.debugNode(child, indent + '  ', lines)
    }

    // Dynamic children
    for (const paramChild of node.paramChildren) {
      this.debugNode(paramChild.node, prefix + '  ', lines)
    }

    // Wildcard child
    if (node.wildcardChild) {
      this.debugNode(node.wildcardChild, prefix + '  ', lines)
    }
  }
}
