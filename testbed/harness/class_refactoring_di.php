<?php

declare(strict_types=1);

/**
 * SysCraft Child Harness: Class Refactoring & Dependency Injection
 * Executed in process-isolated child runtime to verify IoC container resolution and mockability.
 */

require_once dirname(__DIR__) . '/bootstrap/models.php';

$submissionPath = $argv[1] ?? '/workspace/submission/WeatherReportService.php';

if (!file_exists($submissionPath)) {
    echo json_encode([
        'passed' => false,
        'assertions' => [
            [
                'name' => 'Submission File Found',
                'passed' => false,
                'message' => "Submission file not found at {$submissionPath}",
            ],
        ],
    ]);
    exit(1);
}

$rawCode = file_get_contents($submissionPath);

// Tokenize to strip comments, strings, heredocs for static invariants
$tokens = token_get_all($rawCode);
$cleanTokens = [];
$inHeredoc = false;
$inBacktick = false;
$inDoubleQuote = false;

foreach ($tokens as $t) {
    if (!is_array($t)) {
        if ($t === '`') {
            $inBacktick = !$inBacktick;
            continue;
        }
        if ($t === '"') {
            $inDoubleQuote = !$inDoubleQuote;
            continue;
        }
        if ($inHeredoc || $inBacktick || $inDoubleQuote) {
            continue;
        }
        $cleanTokens[] = $t;
        continue;
    }

    if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) {
        continue;
    }

    if ($t[0] === T_START_HEREDOC) {
        $inHeredoc = true;
        continue;
    }
    if ($t[0] === T_END_HEREDOC) {
        $inHeredoc = false;
        continue;
    }

    if ($inHeredoc || $inBacktick || $inDoubleQuote) {
        continue;
    }

    $cleanTokens[] = $t;
}

$cleanCode = '';
foreach ($cleanTokens as $t) {
    $cleanCode .= is_array($t) ? $t[1] : $t;
}

// Invariant 1: Zero direct "new OpenMeteoClient"
$hasNoDirectNew = !preg_match('/new\s+OpenMeteoClient\b/', $cleanCode);

// Invariant 2: Constructor injection of SensorClientInterface
$hasConstructorDi = (bool)preg_match('/function\s+__construct\s*\([^)]*SensorClientInterface\s+\$\w+[^)]*\)/', $cleanCode) ||
    (bool)preg_match('/public\s+function\s+__construct\s*\([^)]*protected\s+SensorClientInterface\s+\$\w+[^)]*\)/', $cleanCode) ||
    (str_contains($cleanCode, '__construct') && str_contains($cleanCode, 'SensorClientInterface'));

// Invariant 3: Container binding registered
$hasContainerBindingCode = (bool)preg_match('/\$this\s*->\s*app\s*->\s*(?:bind|singleton)\s*\(/', $cleanCode) &&
    str_contains($cleanCode, 'SensorClientInterface') &&
    str_contains($cleanCode, 'OpenMeteoClient');

// Invariant 4: Implements interface
$implementsInterface = (bool)preg_match('/class\s+WeatherReportService\b[^{]*implements\b[^{]*WeatherReportServiceInterface/', $cleanCode);

// Load the learner's submission
try {
    require_once $submissionPath;
} catch (Throwable $e) {
    echo json_encode([
        'passed' => false,
        'assertions' => [
            [
                'name' => 'PHP Syntax & Execution',
                'passed' => false,
                'message' => 'Runtime error loading submission: ' . $e->getMessage(),
            ],
        ],
    ]);
    exit(1);
}

// Runtime Verification via IoC Container
$app = new \Illuminate\Container\Container();
\Illuminate\Container\Container::setInstance($app);

$runtimeBindingPassed = false;
$runtimeBindingMessage = 'Missing $this->app->bind(SensorClientInterface::class, ...) in WeatherServiceProvider';

$runtimeMockPassed = false;
$runtimeMockMessage = 'Service could not be executed via IoC container with swapped sensor double';

if (class_exists('\\App\\Services\\WeatherServiceProvider') || class_exists('WeatherServiceProvider')) {
    $providerClass = class_exists('\\App\\Services\\WeatherServiceProvider') 
        ? '\\App\\Services\\WeatherServiceProvider' 
        : 'WeatherServiceProvider';

    try {
        $provider = new $providerClass($app);
        if (method_exists($provider, 'register')) {
            $provider->register();
            if ($app->has(\App\Contracts\SensorClientInterface::class)) {
                $runtimeBindingPassed = true;
                $runtimeBindingMessage = 'SensorClientInterface contract successfully bound in IoC container';
            }
        }
    } catch (Throwable $e) {
        $runtimeBindingMessage = 'Exception registering WeatherServiceProvider: ' . $e->getMessage();
    }
}

// Test Mockability: Swap with a Recording Sensor Double
class RecordingSensorClient implements \App\Contracts\SensorClientInterface {
    public int $callCount = 0;
    public ?string $lastStation = null;
    public function fetchStationTelemetry(string $stationCode): array {
        $this->callCount++;
        $this->lastStation = $stationCode;
        return [
            'station' => $stationCode,
            'temps' => [20.0, 30.0],
            'humidity' => 60,
        ];
    }
}

try {
    $recordingClient = new RecordingSensorClient();
    $app->bind(\App\Contracts\SensorClientInterface::class, fn() => $recordingClient);

    $serviceClass = class_exists('\\App\\Services\\WeatherReportService')
        ? '\\App\\Services\\WeatherReportService'
        : (class_exists('WeatherReportService') ? 'WeatherReportService' : null);

    if ($serviceClass) {
        $service = null;
        if ($app->has(\App\Contracts\WeatherReportServiceInterface::class)) {
            $service = $app->make(\App\Contracts\WeatherReportServiceInterface::class);
        } else {
            $service = $app->make($serviceClass);
        }

        if ($service && method_exists($service, 'generateReport')) {
            $report = $service->generateReport('STN-TEST-99');
            if (
                $recordingClient->callCount === 1 &&
                $recordingClient->lastStation === 'STN-TEST-99' &&
                isset($report['avg_temp_c']) &&
                abs($report['avg_temp_c'] - 25.0) < 0.01 &&
                isset($report['station']) &&
                $report['station'] === 'STN-TEST-99'
            ) {
                $runtimeMockPassed = true;
                $runtimeMockMessage = 'Report generated successfully with swapped mock client (avg_temp_c = 25.0, callCount = 1)';
            } else {
                $runtimeMockMessage = 'generateReport did not delegate to injected SensorClientInterface or return expected averages';
            }
        }
    }
} catch (Throwable $e) {
    $runtimeMockMessage = 'Exception executing WeatherReportService with mock: ' . $e->getMessage();
}

$assertions = [
    [
        'name' => "Eliminated direct concrete instantiation (zero 'new OpenMeteoClient')",
        'passed' => $hasNoDirectNew,
        'message' => $hasNoDirectNew 
            ? 'Zero concrete "new OpenMeteoClient" calls in service code.' 
            : 'Direct instantiation of OpenMeteoClient detected; dependencies must be injected.',
    ],
    [
        'name' => 'Constructor injection of SensorClientInterface abstraction',
        'passed' => $hasConstructorDi,
        'message' => $hasConstructorDi 
            ? 'WeatherReportService constructor declares SensorClientInterface parameter.' 
            : 'WeatherReportService constructor must type-hint SensorClientInterface.',
    ],
    [
        'name' => 'IoC Container binding registered in ServiceProvider register()',
        'passed' => $hasContainerBindingCode && $runtimeBindingPassed,
        'message' => $runtimeBindingPassed 
            ? 'Interface binding verified in container registry.' 
            : $runtimeBindingMessage,
    ],
    [
        'name' => 'WeatherReportService implements WeatherReportServiceInterface and is mockable',
        'passed' => $implementsInterface && $runtimeMockPassed,
        'message' => $runtimeMockPassed 
            ? 'Service implements interface contract and delegates cleanly to test double.' 
            : $runtimeMockMessage,
    ],
];

$allPassed = array_reduce($assertions, fn($acc, $a) => $acc && $a['passed'], true);

echo json_encode([
    'passed' => $allPassed,
    'assertions' => $assertions,
]);

exit($allPassed ? 0 : 1);
