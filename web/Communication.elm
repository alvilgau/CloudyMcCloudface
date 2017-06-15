module Communication exposing (..)

import Json.Decode exposing (decodeString, field, list, map2, string, nullable, oneOf, map, at, maybe, float)
import Json.Encode as Encode
import WebSocket
import DataPoint exposing (decode, DataPoint)
import Tenant exposing (Tenant, encode)


type InMessage
    = Data DataPoint
    | Invalid String


handleMessage : String -> InMessage
handleMessage msg =
    case decodeString inMessageDecoder (Debug.log "JSON:" msg) of
        Ok inMessage ->
            inMessage

        Err e ->
            Invalid <| Debug.log "Error" e


queryKeywordsCmd : Tenant -> List String -> Cmd msg
queryKeywordsCmd tenant keywords =
    let
        encodedKeywords =
            keywords
                |> List.map (\k -> Encode.string k)
                |> Encode.list
    in
        Encode.object [ ( "tenant", Tenant.encode tenant ), ( "keywords", encodedKeywords ) ]
            |> Encode.encode 0
            |> WebSocket.send "ws://localhost:3000"


inMessageDecoder : Json.Decode.Decoder InMessage
inMessageDecoder =
    oneOf [ dataDecoder ]


dataDecoder : Json.Decode.Decoder InMessage
dataDecoder =
    map Data DataPoint.decode
