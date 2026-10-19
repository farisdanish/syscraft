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
      '9-Stage HTTP Ingress Lifecycle: 1. public/index.php entry -> 2. Composer autoloader -> 3. bootstrap/app.php container setup -> 4. HTTP Kernel bootstrap -> 5. Service Providers registered then booted -> 6. Global middleware pipeline -> 7. Router dispatch & route middleware -> 8. Controller action execution -> 9. Response pipeline return.',
      'Service Container & Reflection: The container inspects constructor type-hints via PHP Reflection to auto-wire dependencies. Facades act as static proxies to bound singletons.',
      'N+1 Query Multiplication: Accessing relations inside loops ($post->author) issues 1 parent query + N child queries. Prevent in dev using Model::preventLazyLoading(!app()->isProduction()).',
      'Eager Loading Solution: with([\'author\', \'comments\']) collapses queries to a fixed budget <= 3 by issuing batched WHERE IN queries.',
      'Large Dataset Memory & Streaming: Eager loading large record sets hydrates many Eloquent model instances in RAM (for example, 100k objects can consume 150MB+ in memory benchmarks). cursor() returns a LazyCollection backed by a PHP generator, hydrating one model at a time to reduce peak memory. However, cursor() cannot eager-load relationships; Laravel recommends lazy() when relations must be eager-loaded. Note that PDO may still buffer raw query results depending on driver configuration, so cursor() alone is not guaranteed to remain memory-safe for arbitrarily large datasets. When records are updated during iteration, lazyById() is preferred because it chunks via primary key seeks.',
    ],
    quiz: {
      question: 'In a Laravel controller action, you fetch 25 Post records using Post::all(). Inside a loop over the collection, you access $post->author->name (belongsTo) and $post->comments->count() (hasMany). Assuming no eager loading and no query caching, how many total database queries are executed?',
      options: [
        {
          id: 'opt-a',
          label: '51 queries (1 initial query for posts + 25 for authors + 25 for comments).',
          isCorrect: true,
          explanation: '1 query retrieves the 25 posts. Then, for each of the 25 posts in the loop, accessing ->author triggers 1 query (25 queries) and accessing ->comments triggers 1 query (25 queries). Total = 1 + 25 + 25 = 51 queries.',
        },
        {
          id: 'opt-b',
          label: '27 queries (1 for posts, 1 eager batch for authors, 25 for comments).',
          isCorrect: false,
          explanation: 'Without eager loading via with(), Eloquent does not automatically batch belongsTo relations across loop iterations.',
        },
        {
          id: 'opt-c',
          label: '3 queries (Eloquent automatically batches relationship queries across iterations).',
          isCorrect: false,
          explanation: 'Eloquent does not batch dynamic property relation calls automatically without with() or load(). Each iteration executes on-demand queries.',
        },
      ],
    },
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
     * Task: Add eager loading via with() (or withCount for comments) to collapse query count within allowed budget (<= 3 queries).
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
        prompt: 'Successfully answered follow-up: "Why can’t cursor() eager-load relationships, when should lazy() be preferred, and why is lazyById() safer when records are updated during iteration?"',
      },
    ],
  },
};

/**
 * Hardened PHP comment & inert string stripper for Week 1 validation.
 * Strips comments, docblocks, heredocs, nowdocs, backticks, and non-whitelisted strings.
 */
function stripPhpCommentsAndInertStrings(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;

  const whitelistedLiterals = new Set([
    'author',
    'comments',
    'comments_count',
    'id',
    'title',
    'name',
  ]);

  while (i < len) {
    // Single-line comment //
    if (code[i] === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    // Single-line comment #
    if (code[i] === '#') {
      i++;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    // Multi-line comment /* ... */
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    // Heredocs and Nowdocs: <<<
    if (code[i] === '<' && code[i + 1] === '<' && code[i + 2] === '<') {
      i += 3;
      while (i < len && (code[i] === ' ' || code[i] === '\t')) i++;
      let quoteChar = '';
      if (code[i] === '\'' || code[i] === '"') {
        quoteChar = code[i];
        i++;
      }
      let delimiter = '';
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) {
        delimiter += code[i];
        i++;
      }
      if (quoteChar && code[i] === quoteChar) i++;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';

      while (i < len) {
        const lineStart = i;
        while (i < len && (code[i] === ' ' || code[i] === '\t')) i++;
        if (code.slice(i, i + delimiter.length) === delimiter) {
          const afterDelim = i + delimiter.length;
          if (afterDelim >= len || code[afterDelim] === ';' || code[afterDelim] === '\n' || code[afterDelim] === '\r') {
            while (i < len && code[i] !== '\n') i++;
            result += '\n';
            break;
          }
        }
        i = lineStart;
        while (i < len && code[i] !== '\n') i++;
        if (code[i] === '\n') {
          result += '\n';
          i++;
        }
      }
      continue;
    }
    // Backticks execution
    if (code[i] === '`') {
      i++;
      while (i < len && code[i] !== '`') {
        if (code[i] === '\\') i++;
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i++;
      continue;
    }
    // Single or double quoted strings
    if (code[i] === '\'' || code[i] === '"') {
      const q = code[i];
      let strVal = '';
      i++;
      while (i < len && code[i] !== q) {
        if (code[i] === '\\') {
          i++;
          if (i < len) strVal += code[i];
        } else {
          strVal += code[i];
        }
        i++;
      }
      i++;
      const trimmed = strVal.trim();
      if (
        whitelistedLiterals.has(trimmed) ||
        /^(?:author|comments)(?::[a-zA-Z0-9_,]+)?$/.test(trimmed)
      ) {
        result += `'${trimmed}'`;
      } else {
        result += "''";
      }
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}

function extractMethodBody(code: string, methodName: string): string | null {
  const methodRegex = new RegExp(`function\\s+${methodName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\{`, 'm');
  const match = methodRegex.exec(code);
  if (!match) return null;

  let braceCount = 1;
  let index = match.index + match[0].length;
  const start = index;

  while (index < code.length && braceCount > 0) {
    if (code[index] === '{') braceCount++;
    else if (code[index] === '}') braceCount--;
    index++;
  }

  return code.substring(start, index - 1);
}

// Simulation evaluation function
export function evaluateLaravelDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const cleanCode = stripPhpCommentsAndInertStrings(code);
  const indexBody = extractMethodBody(cleanCode, 'index');

  if (!indexBody) {
    return {
      passed: false,
      queriesExecuted: 51,
      simulatedLatencyMs: 420,
      assertionResults: [
        { name: 'Query budget satisfied', passed: false, message: 'Method index() not found in PostController.' },
        { name: 'Zero per-row queries', passed: false, message: 'Controller action structure is missing.' },
        { name: 'Author relation eager loaded', passed: false, message: 'Missing PostController::index implementation.' },
        { name: 'Comments relation eager loaded or aggregated', passed: false, message: 'Missing PostController::index implementation.' },
      ],
    };
  }

  const hasPostAll = /Post::all\s*\(/.test(indexBody);
  const hasInvalidCommaArgs =
    /with\s*\(\s*['"]author['"]\s*,\s*['"]comments['"]\s*\)/.test(indexBody) ||
    /with\s*\(\s*['"]comments['"]\s*,\s*['"]author['"]\s*\)/.test(indexBody);

  const hasAuthorEager =
    /(?:Post::with|->with)\s*\(\s*\[[^\]]*['"]author(?::[a-zA-Z0-9_,]+)?['"][^\]]*\]\s*\)/.test(indexBody) ||
    /(?:Post::with|->with)\s*\(\s*['"]author(?::[a-zA-Z0-9_,]+)?['"]\s*\)/.test(indexBody);

  const hasCommentsEager =
    !hasInvalidCommaArgs &&
    (/(?:Post::with|->with)\s*\(\s*\[[^\]]*['"]comments(?::[a-zA-Z0-9_,]+)?['"][^\]]*\]\s*\)/.test(indexBody) ||
     /(?:Post::with|->with)\s*\(\s*['"]comments(?::[a-zA-Z0-9_,]+)?['"]\s*\)/.test(indexBody));

  const hasCommentsCount =
    /->withCount\s*\(\s*(?:\[[^\]]*['"]comments['"][^\]]*\]|['"]comments['"])\s*\)/.test(indexBody);

  const usesCommentsCountAttribute = /\$post\s*->\s*comments_count\b/.test(indexBody);
  const usesLazyCommentsCall = /\$post\s*->\s*comments\s*->\s*count\s*\(/.test(indexBody);

  let commentsPassed = false;
  let commentsMessage = 'Missing eager load on comments relation.';

  if (hasCommentsEager) {
    commentsPassed = true;
    commentsMessage = 'SELECT * FROM comments WHERE post_id IN (...) executed via eager load with().';
  } else if (hasCommentsCount) {
    if (usesLazyCommentsCall) {
      commentsPassed = false;
      commentsMessage =
        'Using withCount(\'comments\') aggregates the count into $post->comments_count. Calling $post->comments->count() still triggers lazy relation queries per row.';
    } else if (usesCommentsCountAttribute) {
      commentsPassed = true;
      commentsMessage =
        'Comments count aggregated into $post->comments_count via withCount(\'comments\') with zero per-row queries.';
    } else {
      commentsPassed = false;
      commentsMessage =
        'withCount(\'comments\') is chained, but mapped result does not read $post->comments_count.';
    }
  }

  const hasGet = /->get\s*\(/.test(indexBody);

  let budgetPassed = false;
  let budgetMessage = 'Executed 51 queries for 25 records (Exceeded budget of 3 queries).';
  let perRowPassed = false;
  let perRowMessage = '2 queries triggered per row during $posts->map iteration.';
  let authorMessage = 'Missing eager load on author relation.';

  if (hasInvalidCommaArgs) {
    budgetMessage =
      'Syntax error: Eloquent with() does not accept multiple relationship names as separate string arguments. Use an array: with([\'author\', \'comments\']) or chain ->with(\'author\')->with(\'comments\').';
  } else if (!hasGet) {
    budgetMessage = 'Query builder missing terminal ->get() execution.';
  } else if (hasPostAll) {
    budgetMessage = 'Post::all() is still called; query was not replaced with eager loaded builder.';
  } else if (hasAuthorEager && commentsPassed) {
    const queryCount = hasCommentsCount ? 2 : 3;
    budgetPassed = true;
    budgetMessage = `Executed ${queryCount} queries for 25 records (Target budget <= 3).`;
    perRowPassed = true;
    perRowMessage = 'No queries triggered during $post iteration.';
    authorMessage = 'SELECT * FROM authors WHERE id IN (...) executed via eager load.';
  }

  const passed = budgetPassed && perRowPassed && hasAuthorEager && commentsPassed;
  const queriesExecuted = passed ? (hasCommentsCount ? 2 : 3) : 51;
  const simulatedLatencyMs = passed ? (hasCommentsCount ? 10 : 14) : 420;

  return {
    passed,
    queriesExecuted,
    simulatedLatencyMs,
    assertionResults: [
      { name: 'Query budget satisfied', passed: budgetPassed, message: budgetMessage },
      { name: 'Zero per-row queries', passed: perRowPassed, message: perRowMessage },
      { name: 'Author relation eager loaded', passed: hasAuthorEager && !hasInvalidCommaArgs, message: authorMessage },
      { name: 'Comments relation eager loaded or aggregated', passed: commentsPassed, message: commentsMessage },
    ],
  };
}
