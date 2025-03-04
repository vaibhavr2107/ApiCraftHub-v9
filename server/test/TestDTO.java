package com.example.demo;

import lombok.Data;

@Data
public class TestResponse {
    private String message;
    
    public TestResponse(String message) {
        this.message = message;
    }
}

@Data
public class DataRequest {
    private String name;
    private String value;
}

@Data
public class DataResponse {
    private String id;
    private String status;
}

@Data
public class SoapRequest {
    private String operation;
    private String data;
}

@Data
public class SoapResponse {
    private String result;
    private String timestamp;
}
