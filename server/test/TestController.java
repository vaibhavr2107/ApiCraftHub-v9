package com.example.demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api")
public class TestController {

    @GetMapping("/test")
    public ResponseEntity<TestResponse> getTest(@RequestParam String id) {
        return ResponseEntity.ok(new TestResponse("test"));
    }

    @PostMapping("/data")
    public ResponseEntity<DataResponse> createData(@RequestBody DataRequest request) {
        return ResponseEntity.ok(new DataResponse());
    }
}
