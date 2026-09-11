import { ApolloServerPlugin } from '@apollo/server';
import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  SelectionSetNode,
} from 'graphql';

export const MAX_QUERY_DEPTH = 15;
export const MAX_QUERY_SELECTIONS = 300;

type DocumentCost = { depth: number; selections: number };

const collectFragments = (document: DocumentNode) => {
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  return fragments;
};

const measure = (
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  visitedFragments: Set<string>,
  depth: number,
): DocumentCost => {
  let maxDepth = depth;
  let selections = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      selections += 1;

      if (selection.selectionSet) {
        const nested = measure(
          selection.selectionSet,
          fragments,
          visitedFragments,
          depth + 1,
        );

        maxDepth = Math.max(maxDepth, nested.depth);
        selections += nested.selections;
      }

      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const nested = measure(
        selection.selectionSet,
        fragments,
        visitedFragments,
        depth,
      );

      maxDepth = Math.max(maxDepth, nested.depth);
      selections += nested.selections;

      continue;
    }

    const fragment = fragments.get(selection.name.value);

    // Cycles are rejected by validation later, but this walk runs first.
    if (!fragment || visitedFragments.has(selection.name.value)) continue;

    visitedFragments.add(selection.name.value);

    const nested = measure(
      fragment.selectionSet,
      fragments,
      visitedFragments,
      depth,
    );

    visitedFragments.delete(selection.name.value);

    maxDepth = Math.max(maxDepth, nested.depth);
    selections += nested.selections;
  }

  return { depth: maxDepth, selections };
};

export const graphqlLimitsPlugin = (): ApolloServerPlugin => ({
  async requestDidStart() {
    return {
      async didResolveOperation({ document }) {
        const fragments = collectFragments(document);

        let depth = 0;
        let selections = 0;

        for (const definition of document.definitions) {
          if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

          const cost = measure(
            definition.selectionSet,
            fragments,
            new Set<string>(),
            1,
          );

          depth = Math.max(depth, cost.depth);
          selections += cost.selections;
        }

        if (depth > MAX_QUERY_DEPTH) {
          throw new GraphQLError(
            `Query is too deep. Max depth is ${MAX_QUERY_DEPTH}.`,
          );
        }

        if (selections > MAX_QUERY_SELECTIONS) {
          throw new GraphQLError(
            `Query selects too many fields. Max is ${MAX_QUERY_SELECTIONS}.`,
          );
        }
      },
    };
  },
});
