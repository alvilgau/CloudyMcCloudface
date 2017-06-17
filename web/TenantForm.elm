module TenantForm exposing (view)

import Html exposing (form, button, label, input, span, text, div, h2)
import Html.Attributes exposing (type_, class, for, id, style)
import Html.Events exposing (onClick, onInput)
import Tenant
import Regex exposing (regex, HowMany(..))
import Msg exposing (..)


view : Tenant.Tenant -> List (Html.Html Msg)
view tenant =
    let
        fields =
            tenant.fields
    in
        [ div [ class "twelve columns" ]
            [ h2 [] [ text "Twitter Credentials" ]
            , form [ class "u-full-width" ]
                (List.concat
                    [ labeledTenantInput Tenant.ConsumerKey "Consumer Key" fields.consumerKey
                    , labeledTenantInput Tenant.ConsumerSecret "Consumer Secret" fields.consumerSecret
                    , labeledTenantInput Tenant.Token "Token" fields.token
                    , labeledTenantInput Tenant.TokenSecret "Token Secret" fields.tokenSecret
                    , [ button
                            [ class "button-primary", style [ ( "width", "33%" ) ], type_ "button", onClick <| TenantSelected <| Tenant.custom tenant ]
                            [ text "Submit" ]
                      , button
                            [ class "button", style [ ( "width", "33%" ), ( "float", "right" ) ], type_ "button", onClick <| TenantSelected <| Tenant.default tenant ]
                            [ text "Skip" ]
                      ]
                    ]
                )
            ]
        ]


labeledTenantInput : Tenant.TenantField -> String -> String -> List (Html.Html Msg)
labeledTenantInput fieldId labelString content =
    let
        inputId =
            labelString
                |> String.toLower
                |> Regex.replace All (regex " ") (\_ -> "-")
                |> Regex.replace All (regex "[^a-z0-9]") (\_ -> "")
    in
        [ label [ for inputId ] [ text labelString ]
        , input [ type_ "text", class "u-full-width", onInput (TenantEdited fieldId), id inputId ] [ text content ]
        ]
