package com.example.demo;

import javax.jws.WebService;
import javax.jws.WebMethod;
import javax.jws.WebParam;

@WebService(targetNamespace = "http://example.com/soap")
public class TestService {

    @WebMethod(operationName = "getData")
    public SoapResponse getData(@WebParam(name = "request") SoapRequest request) {
        return new SoapResponse();
    }
}
