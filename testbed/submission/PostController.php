<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $posts = Post::all();
        $payload = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comment_count' => $post->comments->count(),
            ];
        });
        return response()->json($payload);
    }
}
