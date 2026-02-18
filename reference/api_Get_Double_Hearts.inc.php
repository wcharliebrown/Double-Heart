<?php
/**
 * 
 * This script will run whenever the page api-Get-Double-Hearts is accessed.
 *
 * To modify the page fields use $this->db_page_row like this:
 * $this->db_page_row['body'] .= " Hey this is in the body field now!<br />";
 *
 * To replace a token in the page, use curly braces in the page body(or whatever) like this:
 * In the page: ...<input type="text" name="first_name" value="{first_name}">...
 * In this script: $this->db_page_row['body'] = str_replace('{first_name}',$first_name,$this->db_page_row['body']);
 * @var page $this
*/
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE, PUT');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: x-requested-with, X-PINGOTHER, Content-Type, origin, Authorization, accept, client-security-token');
$php_obj = new stdClass;
$php_obj->hearted = false;
$php_obj->notes = "";
$php_obj->black_heart = false;

try {
    $headers = getallheaders();
    if(!isset($headers['Authorization'])) {
        throw new Exception("Missing authorization header",__LINE__);
    }
    $authorization_array = explode(' ', $headers['Authorization']);
    if(count($authorization_array) != 2) {
        throw new Exception("Invalid authorization header",__LINE__);
    }
    if($authorization_array[0] != 'Bearer') {
        throw new Exception("Invalid authorization header",__LINE__);
    }
    $authorization_token = $authorization_array[1];
    $sql_1 = "SELECT * FROM C_token
        WHERE item_name = '" . $this->real_escape_string($authorization_token) . "' 
        AND item_active=1
        ";
    $C_token_row = $this->getOneRowSQL($sql_1);
    $this->log_message("sql_1: " . $sql_1);
    $this->log_message("C_token_row: " . print_r($C_token_row,true));
    if(!$C_token_row) {
        throw new Exception("Invalid authorization token",__LINE__);
    }
    $user_id = $C_token_row['KD_user_item_id'];
    $user_row = $this->getOneRowSQL("SELECT * FROM KD_user WHERE item_id = '" . (int)$user_id . "' AND item_active=1");
    if(!$user_row) {
        throw new Exception("Invalid user id",__LINE__);
    }
    $_SESSION['_user_id'] = $user_row['item_id'];
    $this->db_user_row = $user_row;

	if(!$_GET['propertyId']) {
		throw new Exception("Missing parameter propertyId",__LINE__);
	}
    $propertyId = (int)$_GET['propertyId'];
    if(!$propertyId) {
        throw new Exception("Invalid propertyId",__LINE__);
    }
    $sql_1 = "SELECT C_Double_Heart.*
        FROM C_Double_Heart

        LEFT JOIN C_Heart_Group_C_Double_Heart_join
        ON C_Heart_Group_C_Double_Heart_join.C_Double_Heart_item_id = C_Double_Heart.item_id
        AND C_Heart_Group_C_Double_Heart_join.item_active = 1

        LEFT JOIN C_Heart_Group_KD_user_join
        ON C_Heart_Group_KD_user_join.C_Heart_Group_item_id = C_Heart_Group_C_Double_Heart_join.C_Heart_Group_item_id
        AND C_Heart_Group_KD_user_join.item_active = 1


        WHERE C_Double_Heart.item_name = '" . (int)$propertyId . "'
        AND C_Double_Heart.item_active=1
        AND (
            C_Double_Heart.KD_user_item_id = '" . (int)$user_row['item_id'] . "'
            OR C_Heart_Group_KD_user_join.KD_user_item_id = '" . (int)$user_row['item_id'] . "'
        )
    ";
    $C_Double_Heart_row = $this->getOneRowSQL($sql_1);
    $this->log_message("sql_1: " . $sql_1);
    if($C_Double_Heart_row) {
        $php_obj->hearted = true;
        $php_obj->notes = $C_Double_Heart_row['custom_notes'] ? $C_Double_Heart_row['custom_notes'] : "";
        $php_obj->black_heart = ($C_Double_Heart_row['Black_Heart_yn'] === 'Y');
    } else {
        $php_obj->hearted = false;
        $php_obj->notes = "";
        $php_obj->black_heart = false;
    }
    
} catch(Exception $e) {
	$php_obj->error = $e->getCode();
	$php_obj->error_msg = $e->getMessage();

	$this->log_message("Error code: " . $e->getCode() . ' ' . $e->getMessage(),'E');
}
header('Content-Type: application/json');
$json = json_encode($php_obj);
echo $json;
exit();