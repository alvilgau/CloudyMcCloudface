module Tenant exposing (Tenant, encode)

import Json.Encode exposing (object, string)


type alias Tenant =
    { consumerKey : String
    , token : String
    , consumerSecret : String
    , tokenSecret : String
    }


encode : Tenant -> Json.Encode.Value
encode tenant =
    object
        [ ( "consumerKey", string tenant.consumerKey )
        , ( "token", string tenant.token )
        , ( "consumerSecret", string tenant.consumerSecret )
        , ( "tokenSecret", string tenant.tokenSecret )
        ]
