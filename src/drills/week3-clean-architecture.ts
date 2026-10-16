import type { DrillDefinition } from '../types';

export const WEEK_3_DRILL: DrillDefinition = {
  id: 'w3-class-refactoring-di',
  week: 3,
  title: 'Class Refactoring, Service Container & Dependency Injection',
  tier: 3,
  engine: 'postgresql-docker',
  language: 'php',
  targetFile: 'app/Services/WeatherReportService.php',
  conceptBrief: {
    thesis: 'Tightly coupled controllers that instantiate concrete dependencies with "new" violate the Dependency Inversion Principle (DIP), prevent unit test isolation, and paralyze refactoring. Clean architecture abstracts external clients behind interfaces bound in the Laravel IoC Service Container.',
    diagramType: 'diff',
    keyPoints: [
      'Dependency Inversion: High-level modules (services/controllers) should not depend on low-level modules (HTTP client); both must depend on abstractions (interfaces).',
      'Constructor Injection: Declare typed interface dependencies in class constructors; the Laravel IoC container automatically resolves them via reflection.',
      'IoC Container Binding: Register interface-to-concrete mappings in a ServiceProvider register() method via $this->app->bind() or singleton().',
      'Test Mockability: Inverting dependencies allows tests to swap live third-party network clients with fast in-memory test doubles without modifying production business logic.',
      'Lifecycle Separation: ServiceProvider register() must strictly bind container definitions; boot() runs only after all providers are registered.',
      'Worker Memory Leaks (Octane/FrankenPHP): In traditional PHP-FPM, memory is wiped after every request. In Octane/FrankenPHP, singletons persist across requests; binding stateful classes as singletons leaks user data across requests.',
    ],
  },
  hints: [
    "In WeatherReportService::__construct(), inject SensorClientInterface $sensorClient instead of instantiating OpenMeteoClient with 'new'.",
    "In WeatherServiceProvider::register(), bind the interface: $this->app->bind(\\App\\Contracts\\SensorClientInterface::class, \\App\\Clients\\OpenMeteoClient::class);",
    "Ensure WeatherReportService implements WeatherReportServiceInterface with method: public function generateReport(string $stationCode): array.",
  ],
  initialCode: `<?php

namespace App\\Http\\Controllers;

use App\\Clients\\OpenMeteoClient;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class WeatherReportController extends Controller
{
    /**
     * DRILL: Tightly Coupled Procedural Code (Anti-Pattern)
     * 1. Direct instantiation of concrete client: new OpenMeteoClient()
     *    Cannot mock or swap API provider in unit tests!
     * 2. Business logic directly mixed inside HTTP controller.
     * 3. No Dependency Inversion Principle (DIP) or Service Provider binding.
     *
     * TASK:
     * 1. Refactor into WeatherReportService implementing WeatherReportServiceInterface:
     *    interface WeatherReportServiceInterface {
     *        public function generateReport(string $stationCode): array;
     *    }
     * 2. Inject SensorClientInterface via constructor injection.
     * 3. Register binding in WeatherServiceProvider:
     *    $this->app->bind(SensorClientInterface::class, OpenMeteoClient::class);
     */
    public function generateReport(Request $request): JsonResponse
    {
        // ANTI-PATTERN: Direct concrete instantiation
        $client = new OpenMeteoClient(env('OPEN_METEO_API_KEY'));
        $data = $client->fetchStationTelemetry('STN-MY-042');

        $summary = [
            'station' => 'STN-MY-042',
            'avg_temp_c' => array_sum($data['temps']) / count($data['temps']),
            'generated_at' => now()->toIso8601String(),
        ];

        return response()->json($summary);
    }
}
`,
  solutionCode: `<?php

namespace App\\Services;

use App\\Contracts\\SensorClientInterface;
use App\\Contracts\\WeatherReportServiceInterface;
use Illuminate\\Support\\ServiceProvider;

class WeatherReportService implements WeatherReportServiceInterface
{
    public function __construct(
        protected SensorClientInterface $sensorClient
    ) {}

    public function generateReport(string $stationCode): array
    {
        $data = $this->sensorClient->fetchStationTelemetry($stationCode);

        return [
            'station' => $stationCode,
            'avg_temp_c' => array_sum($data['temps']) / count($data['temps']),
            'generated_at' => now()->toIso8601String(),
        ];
    }
}

class WeatherServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            \\App\\Contracts\\SensorClientInterface::class,
            \\App\\Clients\\OpenMeteoClient::class
        );

        $this->app->bind(
            \\App\\Contracts\\WeatherReportServiceInterface::class,
            WeatherReportService::class
        );
    }
}
`,
  validationRules: {
    type: 'bridge-pest-test',
    expectedAssertions: [
      'Eliminated direct concrete instantiation (zero "new OpenMeteoClient")',
      'Constructor injection of SensorClientInterface abstraction',
      'IoC Container binding registered in ServiceProvider register()',
      'WeatherReportService implements WeatherReportServiceInterface',
    ],
  },
  oralRubric: {
    question: 'Defend Constructor Dependency Injection and IoC Container bindings over static Facades and direct instantiation during clean architecture reviews.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Accurately articulated the Dependency Inversion Principle (DIP): depend upon abstractions, not concrete implementations.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Compared constructor injection vs. Laravel Facades: Facades provide quick DX but hide coupling and create invisible testing dependencies, whereas constructor injection makes dependencies explicit.',
      },
      {
        dimension: 'failure',
        prompt: 'Explained the consequence of putting container bindings in boot() instead of register(): dependencies resolved by other providers in register() will fail with BindingResolutionException.',
      },
      {
        dimension: 'clarity',
        prompt: 'Described IoC reflection: how Laravel inspects constructor parameter type-hints via ReflectionClass to recursively resolve dependency trees.',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "When would you bind as a singleton() versus a standard transient bind()? What is the danger of stateful singletons in Octane/FrankenPHP?"',
      },
    ],
  },
};

/**
 * Hardened PHP comment & inert string stripper for Week 3 validation.
 */
function stripPhpCommentsAndInertStrings(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;

  const whitelistedLiterals = new Set([
    'SensorClientInterface',
    'OpenMeteoClient',
    'WeatherReportServiceInterface',
    'WeatherReportService',
    'generateReport',
    'register',
    'stationCode',
  ]);

  while (i < len) {
    if (code[i] === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    if (code[i] === '#') {
      i++;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (code[i] === "'") {
      let strContent = '';
      i++;
      while (i < len && code[i] !== "'") {
        if (code[i] === '\\' && i + 1 < len) {
          strContent += code[i + 1];
          i += 2;
        } else {
          strContent += code[i];
          i++;
        }
      }
      i++;
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `'${strContent.trim()}'`;
      } else {
        result += "''";
      }
      continue;
    }
    if (code[i] === '"') {
      let strContent = '';
      i++;
      while (i < len && code[i] !== '"') {
        if (code[i] === '\\' && i + 1 < len) {
          strContent += code[i + 1];
          i += 2;
        } else {
          strContent += code[i];
          i++;
        }
      }
      i++;
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `"${strContent.trim()}"`;
      } else {
        result += '""';
      }
      continue;
    }
    if (code[i] === '`') {
      i++;
      while (i < len && code[i] !== '`') {
        if (code[i] === '\\' && i + 1 < len) {
          i += 2;
        } else {
          i++;
        }
      }
      i++;
      result += '""';
      continue;
    }
    if (code[i] === '<' && code[i + 1] === '<' && code[i + 2] === '<') {
      i += 3;
      while (i < len && (code[i] === ' ' || code[i] === '\t')) i++;
      let quote = '';
      if (code[i] === "'" || code[i] === '"') {
        quote = code[i];
        i++;
      }
      let identifier = '';
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) {
        identifier += code[i];
        i++;
      }
      if (quote && code[i] === quote) {
        i++;
      }
      while (i < len && code[i] !== '\n') i++;
      if (code[i] === '\n') {
        result += '\n';
        i++;
      }
      if (identifier.length > 0) {
        while (i < len) {
          const rest = code.slice(i);
          const lineMatch = rest.match(/^[ \t]*([a-zA-Z0-9_]+)(;?)/);
          if (lineMatch && lineMatch[1] === identifier) {
            i += lineMatch[0].length;
            result += '""';
            break;
          }
          const nextNewline = code.indexOf('\n', i);
          if (nextNewline === -1) {
            i = len;
            break;
          } else {
            result += '\n';
            i = nextNewline + 1;
          }
        }
      }
      continue;
    }
    result += code[i];
    i++;
  }
  return result;
}

/**
 * Extract method body based on brace depth.
 */
function extractMethodBody(code: string, methodName: string): string | null {
  const methodRegex = new RegExp(`function\\s+${methodName}\\s*\\([^)]*\\)[^{]*\\{`, 'g');
  const match = methodRegex.exec(code);
  if (!match) return null;

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;

  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
    if (depth === 0) {
      return code.slice(start, i);
    }
    i++;
  }
  return null;
}

/**
 * Deterministic client evaluation for Week 3 Clean Architecture & Dependency Injection
 */
export function evaluateClassRefactoringDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const cleanCode = stripPhpCommentsAndInertStrings(code);

  // 1. Elimination of direct concrete instantiation
  const hasDirectNew = /new\s+OpenMeteoClient\b/.test(cleanCode);
  const hasNoDirectNew = !hasDirectNew;
  const directNewMessage = hasNoDirectNew
    ? 'Passed: Zero "new OpenMeteoClient" calls. Concrete instantiation decoupled.'
    : 'Failed: Direct instantiation "new OpenMeteoClient" detected. Invert dependency via constructor injection.';

  // 2. Constructor injection of SensorClientInterface
  const hasConstructorDi = /function\s+__construct\s*\([^)]*SensorClientInterface\s+\$\w+[^)]*\)/.test(cleanCode) ||
    /public\s+function\s+__construct\s*\([^)]*protected\s+SensorClientInterface\s+\$\w+[^)]*\)/.test(cleanCode) ||
    (cleanCode.includes('__construct') && cleanCode.includes('SensorClientInterface'));
  const constructorMessage = hasConstructorDi
    ? 'Passed: SensorClientInterface abstraction type-hinted in constructor.'
    : 'Failed: Missing constructor injection of SensorClientInterface abstraction.';

  // 3. IoC Container binding in register()
  const registerBody = extractMethodBody(cleanCode, 'register');
  let hasContainerBinding = false;
  let bindingMessage = 'Failed: Missing $this->app->bind(SensorClientInterface::class, OpenMeteoClient::class) in ServiceProvider register().';

  if (registerBody) {
    const bindsSensorInterface = registerBody.includes('SensorClientInterface') && 
      registerBody.includes('OpenMeteoClient') &&
      /\$this\s*->\s*app\s*->\s*(?:bind|singleton)\s*\(/.test(registerBody);

    if (bindsSensorInterface) {
      hasContainerBinding = true;
      bindingMessage = 'Passed: SensorClientInterface bound to OpenMeteoClient in ServiceProvider register().';
    }
  }

  // 4. WeatherReportService implements WeatherReportServiceInterface
  const implementsInterface = /class\s+WeatherReportService\b[^{]*implements\b[^{]*WeatherReportServiceInterface/.test(cleanCode);
  const interfaceMessage = implementsInterface
    ? 'Passed: WeatherReportService adheres to WeatherReportServiceInterface contract.'
    : 'Failed: WeatherReportService must implement WeatherReportServiceInterface.';

  const passed = hasNoDirectNew && hasConstructorDi && hasContainerBinding && implementsInterface;

  return {
    passed,
    queriesExecuted: 0,
    simulatedLatencyMs: 24,
    assertionResults: [
      {
        name: 'Eliminated Direct Concrete Instantiation',
        passed: hasNoDirectNew,
        message: directNewMessage,
      },
      {
        name: 'Constructor Interface Injection (DIP)',
        passed: hasConstructorDi,
        message: constructorMessage,
      },
      {
        name: 'IoC Container Binding in register()',
        passed: hasContainerBinding,
        message: bindingMessage,
      },
      {
        name: 'Contract Implementation Compliance',
        passed: implementsInterface,
        message: interfaceMessage,
      },
    ],
  };
}
