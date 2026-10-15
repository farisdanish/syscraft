import type { DrillDefinition } from '../types';

export const WEEK_1_DRILL: DrillDefinition = {
  id: 'w1-laravel-internals-n1',
  week: 1,
  title: 'Laravel Request Lifecycle & Eloquent N+1 Elimination',
  tier: 2,
  engine: 'simulated-laravel',
  language: 'php',
  targetFile: 'app/Http/Controllers/PostController.php',
  conceptBrief: {
    thesis: 'Every Laravel HTTP request journeys through a strict pipeline before reaching controllers. Careless relation access inside loops causes catastrophic N+1 query multiplication.',
    diagramType: 'lifecycle',
    keyPoints: [
      'Ingress starts at public/index.php, which loads Composer autoloader and boots bootstrap/app.php.',
      'The HTTP Kernel bootstraps service providers (register then boot) before passing requests through global middleware.',
      'The Service Container uses reflection to resolve controller dependencies, while Facades act as static proxies to bound singletons.',
      'N+1 Problem: Accessing relations ($post->author) inside iteration runs 1 initial query + N additional queries.',
      'Solution: Eager load relations via with([\'author\', \'comments\']) to collapse queries to a fixed budget <= 3.',
    ],
  },
  hints: [
    "Instead of calling Post::all(), use Eloquent's eager loading method with() to specify related models.",
    "Pass an array of relationships to with(): ['author', 'comments'].",
    "Chain ->get() after with(['author', 'comments']) to execute the batch query: Post::with(['author', 'comments'])->get().",
  ],
  initialCode: `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller
{
    /**
     * Display a listing of posts with author and comments.
     *
     * DRILL: Currently executes an N+1 query loop!
     * 1 query for posts + 25 queries for authors + 25 queries for comments = 51 queries.
     * Task: Add eager loading to collapse query count within the allowed budget (<= 3 queries).
     */
    public function index(Request $request): JsonResponse
    {
        // BUG: Non-eager loaded query
        $posts = Post::all();

        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name, // N+1 query triggered per row
                'comments_count' => $post->comments->count(), // N+1 query triggered per row
            ];
        });

        return response()->json($data);
    }
}
`,
  solutionCode: `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller
{
    /**
     * Display a listing of posts with author and comments.
     *
     * FIXED: Eager loading with(['author', 'comments']) collapses queries
     * to exactly 3 queries, satisfying the query budget with zero per-row queries.
     */
    public function index(Request $request): JsonResponse
    {
        $posts = Post::with(['author', 'comments'])->get();

        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comments_count' => $post->comments->count(),
            ];
        });

        return response()->json($data);
    }
}
`,
  validationRules: {
    type: 'ast-property',
    expectedAssertions: [
      'Query budget satisfied (<= 3 distinct queries for 25 records)',
      'Zero database queries executed during row iteration loop',
      'Author relationship eager loaded via with()',
      'Comments relationship eager loaded via with()',
    ],
    queryBudget: 3,
  },
  oralRubric: {
    question: 'Explain the Laravel request lifecycle aloud unscripted in 3 minutes, and explain how Eloquent eager loading prevents N+1 query multiplication.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Mentioned public/index.php, Composer autoload, HTTP Kernel bootstrap, Service Providers (register vs boot), and middleware pipeline in exact sequence.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Articulated trade-off between Facades (convenient static syntax) vs. Constructor Dependency Injection (explicit dependencies, testable isolation).',
      },
      {
        dimension: 'failure',
        prompt: 'Explained exact mechanism of N+1 failure: 1 initial SELECT * FROM posts followed by separate SELECT per row, scaling linearly with record volume.',
      },
      {
        dimension: 'clarity',
        prompt: 'Spoke fluently, confidently, and unscripted within the 3-minute time window without reading from prepared notes.',
      },
      {
        dimension: 'challenge',
        prompt: 'Successfully answered follow-up: "What happens if an eager-loaded relation contains 100,000 sub-records? How does LazyCollection/cursor() mitigate memory saturation?"',
      },
    ],
  },
};

// Simulation evaluation function
export function evaluateLaravelDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const hasWith = /Post::with\s*\(\s*\[?['"]author['"],\s*['"]comments['"]\]?\s*\)/.test(code) ||
                  /Post::with\s*\(\s*['"]author['"],\s*['"]comments['"]\s*\)/.test(code) ||
                  (code.includes('with(') && code.includes('author') && code.includes('comments'));

  if (hasWith) {
    return {
      passed: true,
      queriesExecuted: 3,
      simulatedLatencyMs: 14,
      assertionResults: [
        { name: 'Query budget satisfied', passed: true, message: 'Executed 3 queries for 25 records (Target budget <= 3).' },
        { name: 'Zero per-row queries', passed: true, message: 'No queries triggered during $post iteration.' },
        { name: 'Author relation eager loaded', passed: true, message: 'SELECT * FROM authors WHERE id IN (...) executed.' },
        { name: 'Comments relation eager loaded', passed: true, message: 'SELECT * FROM comments WHERE post_id IN (...) executed.' },
      ],
    };
  }

  return {
    passed: false,
    queriesExecuted: 51,
    simulatedLatencyMs: 420,
    assertionResults: [
      { name: 'Query budget satisfied', passed: false, message: 'Executed 51 queries for 25 records (Exceeded budget of 3 queries).' },
      { name: 'Zero per-row queries', passed: false, message: '2 queries triggered per row during $posts->map iteration.' },
      { name: 'Author relation eager loaded', passed: false, message: 'Missing eager load on author relation.' },
      { name: 'Comments relation eager loaded', passed: false, message: 'Missing eager load on comments relation.' },
    ],
  };
}
