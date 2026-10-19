<?php

namespace {
    class QueryLog {
        public static array $queries = [];
        public static function log(string $sql, array $params = []): void {
            self::$queries[] = ['sql' => $sql, 'params' => $params];
        }
        public static function reset(): void {
            self::$queries = [];
        }
    }

    function executeTrackedQuery(PDO $pdo, string $sql, array $params = []): array {
        \QueryLog::log($sql, $params);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    function response() {
        return new class {
            public function json(array $data) {
                return new \Illuminate\Http\JsonResponse($data);
            }
        };
    }
}

namespace Illuminate\Http {
    class Request {}
    class JsonResponse {
        public array $data;
        public function __construct(array $data) { $this->data = $data; }
    }
}

namespace App\Http\Controllers {
    class Controller {}
}

namespace App\Models {
    use PDO;
    use Countable;
    use IteratorAggregate;
    use ArrayIterator;
    use Traversable;

    class Author {
        public int $id;
        public string $name;
        public function __construct(array $data) {
            $this->id = (int)$data['id'];
            $this->name = $data['name'];
        }
    }

    class Comment {
        public int $id;
        public int $post_id;
        public string $body;
        public function __construct(array $data) {
            $this->id = (int)$data['id'];
            $this->post_id = (int)$data['post_id'];
            $this->body = $data['body'];
        }
    }

    class CommentCollection implements Countable {
        private array $items;
        public function __construct(array $items) { $this->items = $items; }
        public function count(): int { return count($this->items); }
    }

    class Post {
        public int $id;
        public int $author_id;
        public string $title;
        public string $content;
        public array $relations = [];
        private static ?PDO $pdo = null;

        public static function setPdo(PDO $pdo): void {
            self::$pdo = $pdo;
        }

        public static function all(): PostCollection {
            $rows = \executeTrackedQuery(self::$pdo, "SELECT id, author_id, title, content FROM posts ORDER BY id LIMIT 25;");
            $posts = array_map(fn($r) => new Post($r), $rows);
            return new PostCollection($posts);
        }

        public static function with(array|string $relations): PostQueryBuilder {
            $rels = is_array($relations) ? $relations : func_get_args();
            return new PostQueryBuilder(self::$pdo, $rels);
        }

        public function __construct(array $data) {
            $this->id = (int)$data['id'];
            $this->author_id = (int)$data['author_id'];
            $this->title = $data['title'];
            $this->content = $data['content'] ?? '';
        }

        public function __set(string $name, $value) {
            $this->relations[$name] = $value;
        }

        public function __get(string $name) {
            if (isset($this->relations[$name])) {
                return $this->relations[$name];
            }
            if ($name === 'author') {
                $rows = \executeTrackedQuery(self::$pdo, "SELECT id, name FROM authors WHERE id = ? LIMIT 1;", [$this->author_id]);
                $this->relations['author'] = !empty($rows) ? new Author($rows[0]) : null;
                return $this->relations['author'];
            }
            if ($name === 'comments') {
                $rows = \executeTrackedQuery(self::$pdo, "SELECT id, post_id, body FROM comments WHERE post_id = ?;", [$this->id]);
                $this->relations['comments'] = new CommentCollection(array_map(fn($r) => new Comment($r), $rows));
                return $this->relations['comments'];
            }
            return null;
        }
    }

    class PostQueryBuilder {
        private PDO $pdo;
        private array $relations;
        public function __construct(PDO $pdo, array $relations) {
            $this->pdo = $pdo;
            $this->relations = $relations;
        }

        public function get(): PostCollection {
            $rows = \executeTrackedQuery($this->pdo, "SELECT id, author_id, title, content FROM posts ORDER BY id LIMIT 25;");
            $posts = array_map(fn($r) => new Post($r), $rows);
            $postIds = array_map(fn($p) => $p->id, $posts);
            $authorIds = array_values(array_unique(array_map(fn($p) => $p->author_id, $posts)));

            if (in_array('author', $this->relations) && !empty($authorIds)) {
                $placeholders = implode(',', array_fill(0, count($authorIds), '?'));
                $authorRows = \executeTrackedQuery($this->pdo, "SELECT id, name FROM authors WHERE id IN ($placeholders);", $authorIds);
                $authorsById = [];
                foreach ($authorRows as $ar) {
                    $authorsById[$ar['id']] = new Author($ar);
                }
                foreach ($posts as $p) {
                    $p->relations['author'] = $authorsById[$p->author_id] ?? null;
                }
            }

            if (in_array('comments', $this->relations) && !empty($postIds)) {
                $placeholders = implode(',', array_fill(0, count($postIds), '?'));
                $commentRows = \executeTrackedQuery($this->pdo, "SELECT id, post_id, body FROM comments WHERE post_id IN ($placeholders);", $postIds);
                $commentsByPost = [];
                foreach ($commentRows as $cr) {
                    $commentsByPost[$cr['post_id']][] = new Comment($cr);
                }
                foreach ($posts as $p) {
                    $p->relations['comments'] = new CommentCollection($commentsByPost[$p->id] ?? []);
                }
            }

            return new PostCollection($posts);
        }
    }

    class PostCollection implements IteratorAggregate, Countable {
        private array $items;
        public function __construct(array $items) { $this->items = $items; }
        public function getIterator(): Traversable { return new ArrayIterator($this->items); }
        public function count(): int { return count($this->items); }
        public function map(callable $cb): array { return array_map($cb, $this->items); }
    }
}

namespace Illuminate\Support {
    abstract class ServiceProvider {
        protected $app;
        public function __construct($app) {
            $this->app = $app;
        }
        public function register(): void {}
        public function boot(): void {}
    }
}

namespace Illuminate\Container {
    use Closure;
    use ReflectionClass;
    use Exception;

    class Container {
        private static ?Container $instance = null;
        private array $bindings = [];
        private array $instances = [];

        public static function getInstance(): Container {
            if (self::$instance === null) {
                self::$instance = new self();
            }
            return self::$instance;
        }

        public static function setInstance(?Container $container): void {
            self::$instance = $container;
        }

        public function bind(string $abstract, $concrete = null, bool $shared = false): void {
            if ($concrete === null) {
                $concrete = $abstract;
            }
            $this->bindings[$abstract] = [
                'concrete' => $concrete,
                'shared' => $shared,
            ];
            unset($this->instances[$abstract]);
        }

        public function singleton(string $abstract, $concrete = null): void {
            $this->bind($abstract, $concrete, true);
        }

        public function make(string $abstract, array $parameters = []) {
            if (isset($this->instances[$abstract])) {
                return $this->instances[$abstract];
            }

            $concrete = $this->bindings[$abstract]['concrete'] ?? $abstract;

            if ($concrete instanceof Closure) {
                $object = $concrete($this, $parameters);
            } elseif (is_string($concrete)) {
                $reflector = new ReflectionClass($concrete);
                if (!$reflector->isInstantiable()) {
                    throw new Exception("Target [$concrete] is not instantiable.");
                }
                $constructor = $reflector->getConstructor();
                if ($constructor === null) {
                    $object = new $concrete();
                } else {
                    $dependencies = [];
                    foreach ($constructor->getParameters() as $param) {
                        $type = $param->getType();
                        if ($type && !$type->isBuiltin()) {
                            $dependencies[] = $this->make($type->getName());
                        } elseif ($param->isDefaultValueAvailable()) {
                            $dependencies[] = $param->getDefaultValue();
                        } else {
                            throw new Exception("Cannot resolve parameter [{$param->getName()}] in class [{$concrete}].");
                        }
                    }
                    $object = $reflector->newInstanceArgs($dependencies);
                }
            } else {
                $object = $concrete;
            }

            if (!empty($this->bindings[$abstract]['shared'])) {
                $this->instances[$abstract] = $object;
            }

            return $object;
        }

        public function has(string $abstract): bool {
            return isset($this->bindings[$abstract]) || isset($this->instances[$abstract]);
        }

        public function getBindings(): array {
            return $this->bindings;
        }
    }
}

namespace App\Contracts {
    interface SensorClientInterface {
        public function fetchStationTelemetry(string $stationCode): array;
    }

    interface WeatherReportServiceInterface {
        public function generateReport(string $stationCode): array;
    }
}

namespace App\Clients {
    use App\Contracts\SensorClientInterface;

    class OpenMeteoClient implements SensorClientInterface {
        private ?string $apiKey;
        public function __construct(?string $apiKey = null) {
            $this->apiKey = $apiKey;
        }
        public function fetchStationTelemetry(string $stationCode): array {
            return [
                'station' => $stationCode,
                'temps' => [28.5, 29.1, 31.0, 30.2, 27.8],
                'humidity' => 78,
            ];
        }
    }
}

namespace {
    if (!function_exists('now')) {
        function now() {
            return new class {
                public function toIso8601String(): string {
                    return date('c');
                }
                public function format(string $fmt): string {
                    return date($fmt);
                }
            };
        }
    }

    if (!function_exists('env')) {
        function env(string $key, $default = null) {
            $val = getenv($key);
            return $val !== false ? $val : $default;
        }
    }

    class_alias('App\Http\Controllers\Controller', 'Controller');
    class_alias('App\Models\Post', 'Post');
    class_alias('Illuminate\Http\Request', 'Request');
    class_alias('Illuminate\Http\JsonResponse', 'JsonResponse');
    class_alias('Illuminate\Support\ServiceProvider', 'ServiceProvider');
    class_alias('Illuminate\Container\Container', 'Container');
    class_alias('App\Contracts\SensorClientInterface', 'SensorClientInterface');
    class_alias('App\Contracts\WeatherReportServiceInterface', 'WeatherReportServiceInterface');
    class_alias('App\Clients\OpenMeteoClient', 'OpenMeteoClient');
}

